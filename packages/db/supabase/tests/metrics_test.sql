-- M3-10: adherence, hard sets per muscle and skill ratings, with exact values (rules in docs/plans/m3-metrics.md).
begin;
select plan(19);

insert into auth.users (id, email, email_confirmed_at) values
  ('a5000000-0000-0000-0000-0000000000a1', 'coach-a@t.test', now()),
  ('b5000000-0000-0000-0000-0000000000b1', 'coach-b@t.test', now()),
  ('c5000000-0000-0000-0000-0000000000c1', 'kabir@t.test', now()),
  ('d5000000-0000-0000-0000-0000000000d1', 'neha@t.test', now());
insert into public.user_roles (user_id, role) values ('a5000000-0000-0000-0000-0000000000a1', 'coach'), ('b5000000-0000-0000-0000-0000000000b1', 'coach');
update public.profiles set display_name = 'Kabir', date_of_birth = '1998-06-12' where id = 'c5000000-0000-0000-0000-0000000000c1';
update public.profiles set display_name = 'Neha', date_of_birth = '1996-02-02' where id = 'd5000000-0000-0000-0000-0000000000d1';
insert into public.athlete_basics (user_id, days_per_week) values ('c5000000-0000-0000-0000-0000000000c1', 6), ('d5000000-0000-0000-0000-0000000000d1', 3);

create temp table ids (name text primary key, v text);
grant all on ids to authenticated;
create temp table sid (program text, day int, id uuid);
grant all on sid to authenticated;
create function pg_temp.item(slug text) returns uuid language sql as $$ select id from public.content_items where content_items.slug = item.slug $$;
set local role authenticated;

-- Coach A: gym days 1 (bench, push-ups), 3 (lat pulldown) and 6 (squat); boxing every day 1 to 6 with the jab,
-- skipping on days 1 and 2, and back squats on day 2, which are gym work in a boxing session.
select set_config('request.jwt.claims', '{"sub":"a5000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
insert into ids select 'gym', public.create_program('Muscle Builder', 'gym');
select public.save_program_draft((select v from ids where name = 'gym')::uuid, 'Muscle Builder', '', 4, jsonb_build_array(
  jsonb_build_object('week', 1, 'day', 1, 'title', 'Upper', 'items', jsonb_build_array(
    jsonb_build_object('item', pg_temp.item('barbell-bench-press'), 'type', 'sets', 'sets', 3, 'reps', 8, 'load_kg', 50),
    jsonb_build_object('item', pg_temp.item('push-up'), 'type', 'sets', 'sets', 1, 'reps', 10))),
  jsonb_build_object('week', 1, 'day', 3, 'title', 'Pull', 'items', jsonb_build_array(
    jsonb_build_object('item', pg_temp.item('lat-pulldown'), 'type', 'sets', 'sets', 2, 'reps', 10))),
  jsonb_build_object('week', 1, 'day', 6, 'title', 'Legs', 'items', jsonb_build_array(
    jsonb_build_object('item', pg_temp.item('back-squat'), 'type', 'sets', 'sets', 3, 'reps', 5)))));
select public.publish_program((select v from ids where name = 'gym')::uuid);
insert into ids select 'gym_code', public.program_invite((select v from ids where name = 'gym')::uuid);

insert into ids select 'box', public.create_program('Boxing Fundamentals', 'boxing');
select public.save_program_draft((select v from ids where name = 'box')::uuid, 'Boxing Fundamentals', '', 4,
  (select jsonb_agg(jsonb_build_object('week', 1, 'day', d, 'title', 'Day ' || d, 'items',
     jsonb_build_array(jsonb_build_object('item', pg_temp.item('jab'), 'type', 'rounds', 'rounds', 3, 'work_s', 60, 'rest_s', 30))
     || case when d <= 2 then jsonb_build_array(jsonb_build_object('item', pg_temp.item('skipping'), 'type', 'time', 'seconds', 300)) else '[]'::jsonb end
     || case when d = 2 then jsonb_build_array(jsonb_build_object('item', pg_temp.item('back-squat'), 'type', 'sets', 'sets', 2, 'reps', 5)) else '[]'::jsonb end))
   from generate_series(1, 6) d));
select public.publish_program((select v from ids where name = 'box')::uuid);
insert into ids select 'box_code', public.program_invite((select v from ids where name = 'box')::uuid);

select set_config('request.jwt.claims', '{"sub":"c5000000-0000-0000-0000-0000000000c1","role":"authenticated"}', true);
insert into ids select 'e_gym', public.join_program((select v from ids where name = 'gym_code'));
insert into ids select 'e_box', public.join_program((select v from ids where name = 'box_code'));

-- Kabir started both five days ago, so day 1 was five days ago and day 6 is today.
reset role;
update public.enrollments set start_date = public.india_today() - 5 where athlete_id = 'c5000000-0000-0000-0000-0000000000c1';
insert into sid select p.name, s.day, s.id from public.program_sessions s join public.program_versions v on v.id = s.version_id
  join ids p on p.v::uuid = v.program_id where v.published_at is not null;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"c5000000-0000-0000-0000-0000000000c1","role":"authenticated"}', true);

-- Gym day 1, finished: bench 8 @ RPE 8, 8 @ 8, 8 @ 6 and a failed 0 @ 10; push-ups 10 @ 7.
select public.log_set((select id from sid where program = 'gym' and day = 1), public.india_today() - 5, 1, n, r, l, e)
from (values (1, 8, 50.0, 8), (2, 8, 50.0, 8), (3, 8, 50.0, 6), (4, 0, 55.0, 10)) v(n, r, l, e);
select public.log_set((select id from sid where program = 'gym' and day = 1), public.india_today() - 5, 2, 1, 10, null, 7);
select public.finish_session((select id from sid where program = 'gym' and day = 1), public.india_today() - 5);
-- Gym day 3, not finished: two lat pulldowns at RPE 9. Day 6 (today) not started.
select public.log_set((select id from sid where program = 'gym' and day = 3), public.india_today() - 3, 1, n, 10, 40, 9) from generate_series(1, 2) n;

-- Boxing: the jab's technique on days 1 to 6 is 1, 4, 4, 3, 4, 5; skipping 3 then 4; days 1, 2, 3 and 6 finished.
select public.log_drill((select id from sid where program = 'box' and day = d), public.india_today() - 6 + d, 1, 3, t, 6, '')
from (values (1, 1), (2, 4), (3, 4), (4, 3), (5, 4), (6, 5)) v(d, t);
select public.log_drill((select id from sid where program = 'box' and day = d), public.india_today() - 6 + d, 2, null, t, 5, '')
from (values (1, 3), (2, 4)) v(d, t);
-- Back squats in the boxing session, RPE 9: hard sets, but not from a gym log.
select public.log_set((select id from sid where program = 'box' and day = 2), public.india_today() - 4, 3, n, 5, 80, 9) from generate_series(1, 2) n;
select public.finish_session((select id from sid where program = 'box' and day = d), public.india_today() - 6 + d) from unnest(array[1, 2, 3, 6]) d;

-- Adherence: completed over scheduled up to today, today included.
select is((select scheduled || '/' || completed from public.adherence('c5000000-0000-0000-0000-0000000000c1', (select v from ids where name = 'gym')::uuid)),
  '3/1', 'gym: days 1, 3 and 6 scheduled; only day 1 finished (day 3 was logged but not finished)');
select is((select scheduled || '/' || completed from public.adherence('c5000000-0000-0000-0000-0000000000c1', (select v from ids where name = 'box')::uuid)),
  '6/4', 'boxing: six days scheduled, four finished');
select is((select scheduled || '/' || completed from public.adherence('c5000000-0000-0000-0000-0000000000c1')), '9/5', 'across both programs');

-- Hard sets per muscle: primary muscle only, gym logs only, at least one rep at RPE 7 or more.
select is((select string_agg(muscle_id || ':' || sets, ',' order by muscle_id) from public.hard_sets_per_muscle('c5000000-0000-0000-0000-0000000000c1', public.india_today() - 5, public.india_today())),
  'chest:3,lats:2', 'bench gives two (not the RPE 6 or the failed set), push-ups one, pulldowns two; boxing''s squats none');
select is((select string_agg(muscle_id || ':' || sets, ',') from public.hard_sets_per_muscle('c5000000-0000-0000-0000-0000000000c1', public.india_today() - 3, public.india_today())),
  'lats:2', 'only sets inside the dates count');
select is((select string_agg(muscle_id || ':' || sets, ',') from public.hard_sets_per_muscle('c5000000-0000-0000-0000-0000000000c1', public.india_today() - 5, public.india_today(),
  (select l.id from public.session_logs l where l.session_id = (select id from sid where program = 'gym' and day = 3)))),
  'lats:2', 'with a log, only that session''s sets count');
reset role;
select throws_ok($$ insert into public.content_muscles (item_id, muscle_id, is_primary) values (pg_temp.item('barbell-bench-press'), 'upper_chest', true) $$,
  '23505', null, 'an exercise has one primary muscle at most');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"c5000000-0000-0000-0000-0000000000c1","role":"authenticated"}', true);
select is((select name || '|' || muscle_group from public.hard_sets_per_muscle('c5000000-0000-0000-0000-0000000000c1', public.india_today() - 5, public.india_today()) where muscle_id = 'lats'),
  'Lats|back', 'with the muscle''s name and group');

-- Skill rating: the mean of the last five technique logs per drill, one decimal.
select is((select rating || '|' || logs from public.skill_ratings('c5000000-0000-0000-0000-0000000000c1') where item_id = pg_temp.item('jab')),
  '4.0|5', 'the jab: 5, 4, 3, 4, 4 (the oldest 1 drops out) is 4.0');
select is((select rating || '|' || logs from public.skill_ratings('c5000000-0000-0000-0000-0000000000c1') where item_id = pg_temp.item('skipping')),
  '3.5|2', 'skipping: 4 and 3 is 3.5');
select is((select count(*)::int from public.skill_ratings('c5000000-0000-0000-0000-0000000000c1') where item_id = pg_temp.item('back-squat')), 0, 'sets have no technique rating');

-- Readers: the coach sees the same numbers; another coach and another athlete see nothing.
select set_config('request.jwt.claims', '{"sub":"a5000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
select is((select scheduled || '/' || completed from public.adherence('c5000000-0000-0000-0000-0000000000c1')), '9/5', 'Kabir''s coach gets the same adherence');
select is((select string_agg(muscle_id || ':' || sets, ',' order by muscle_id) from public.hard_sets_per_muscle('c5000000-0000-0000-0000-0000000000c1', public.india_today() - 5, public.india_today())),
  'chest:3,lats:2', 'and the same hard sets');
select is((select rating from public.skill_ratings('c5000000-0000-0000-0000-0000000000c1') where item_id = pg_temp.item('jab')), 4.0, 'and the same skill rating');
select set_config('request.jwt.claims', '{"sub":"b5000000-0000-0000-0000-0000000000b1","role":"authenticated"}', true);
select is((select scheduled || '/' || completed from public.adherence('c5000000-0000-0000-0000-0000000000c1')), '0/0', 'another coach gets nothing');
select is((select count(*)::int from public.skill_ratings('c5000000-0000-0000-0000-0000000000c1')) + (select count(*)::int from public.hard_sets_per_muscle('c5000000-0000-0000-0000-0000000000c1', public.india_today() - 5, public.india_today())),
  0, 'and no ratings or sets');
select set_config('request.jwt.claims', '{"sub":"d5000000-0000-0000-0000-0000000000d1","role":"authenticated"}', true);
select is((select scheduled || '/' || completed from public.adherence('c5000000-0000-0000-0000-0000000000c1')), '0/0', 'nor does another athlete');

-- Leaving a program takes it out of adherence; the logs stay for ratings.
select set_config('request.jwt.claims', '{"sub":"c5000000-0000-0000-0000-0000000000c1","role":"authenticated"}', true);
select public.leave_program((select v from ids where name = 'e_box')::uuid);
select is((select scheduled || '/' || completed from public.adherence('c5000000-0000-0000-0000-0000000000c1')), '3/1', 'after leaving boxing, adherence covers the gym program only');
select is((select rating from public.skill_ratings('c5000000-0000-0000-0000-0000000000c1') where item_id = pg_temp.item('jab')), 4.0, 'and the jab rating stays');

select * from finish();
rollback;
