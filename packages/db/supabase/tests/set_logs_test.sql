-- M3-08: set logs for S&C and gym. Same writers and readers as the session logs they belong to.
begin;
select plan(26);

insert into auth.users (id, email, email_confirmed_at) values
  ('a3000000-0000-0000-0000-0000000000a1', 'coach-a@t.test', now()),
  ('b3000000-0000-0000-0000-0000000000b1', 'coach-b@t.test', now()),
  ('c3000000-0000-0000-0000-0000000000c1', 'neha@t.test', now()),
  ('d3000000-0000-0000-0000-0000000000d1', 'kabir@t.test', now());
insert into public.user_roles (user_id, role) values ('a3000000-0000-0000-0000-0000000000a1', 'coach'), ('b3000000-0000-0000-0000-0000000000b1', 'coach');
update public.profiles set display_name = 'Neha', date_of_birth = '1996-02-02' where id = 'c3000000-0000-0000-0000-0000000000c1';
update public.profiles set display_name = 'Kabir', date_of_birth = '1998-06-12' where id = 'd3000000-0000-0000-0000-0000000000d1';
insert into public.athlete_basics (user_id, days_per_week) values ('c3000000-0000-0000-0000-0000000000c1', 4), ('d3000000-0000-0000-0000-0000000000d1', 4);

create temp table ids (name text primary key, v text);
grant all on ids to authenticated;
set local role authenticated;

-- Coach A: gym, day 1 "Upper A": bench 3 x 8 at 50 kg, push-ups 3 x 10, and a rounds drill.
select set_config('request.jwt.claims', '{"sub":"a3000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
insert into ids select 'p', public.create_program('Muscle Builder', 'gym');
select public.save_program_draft((select v from ids where name = 'p')::uuid, 'Muscle Builder', '', 4, jsonb_build_array(
  jsonb_build_object('week', 1, 'day', 1, 'title', 'Upper A', 'items', jsonb_build_array(
    jsonb_build_object('item', (select id from public.content_items where slug = 'barbell-bench-press'), 'type', 'sets', 'sets', 3, 'reps', 8, 'load_kg', 50),
    jsonb_build_object('item', (select id from public.content_items where slug = 'push-up'), 'type', 'sets', 'sets', 3, 'reps', 10),
    jsonb_build_object('item', (select id from public.content_items where slug = 'jab'), 'type', 'rounds', 'rounds', 2, 'work_s', 60, 'rest_s', 30)))));
select public.publish_program((select v from ids where name = 'p')::uuid);
insert into ids select 'code', public.program_invite((select v from ids where name = 'p')::uuid);

select set_config('request.jwt.claims', '{"sub":"c3000000-0000-0000-0000-0000000000c1","role":"authenticated"}', true);
insert into ids select 'e', public.join_program((select v from ids where name = 'code'));
reset role;
insert into ids select 's', s.id from public.program_sessions s join public.program_versions v on v.id = s.version_id
  where v.program_id = (select v from ids where name = 'p')::uuid and v.published_at is not null;
set local role authenticated;

-- Neha logs the bench set by set.
insert into ids select 'log', public.log_set((select v from ids where name = 's')::uuid, public.india_today(), 1, 1, 8, 52.5, 8);
select is((select reps || '|' || load_kg || '|' || rpe from public.set_logs where set_no = 1), '8|52.50|8', 'a set keeps reps, load and effort');
select is((select type::text || '|' || (technique is null)::text || '|' || (effort is null)::text from public.item_logs where position = 1),
  'sets|true|true', 'the exercise''s item log has no technique or drill effort');
select is(public.log_set((select v from ids where name = 's')::uuid, public.india_today(), 1, 1, 7, 52.5, 9), (select v from ids where name = 'log')::uuid,
  'logging the same set again returns the same log');
select is((select count(*)::int || '|' || min(reps) from public.set_logs where set_no = 1), '1|7', 'and replaces the set');
select public.log_set((select v from ids where name = 's')::uuid, public.india_today(), 1, 2, 8, 52.5, 8);
select public.log_set((select v from ids where name = 's')::uuid, public.india_today(), 1, 3, 6, 50, 10);
select is((select string_agg(set_no || ':' || reps || 'x' || load_kg, ',' order by set_no) from public.set_logs), '1:7x52.50,2:8x52.50,3:6x50.00', 'three sets under one exercise');
select lives_ok(format($$ select public.log_set(%L, public.india_today(), 2, 1, 10, null, 7) $$, (select v from ids where name = 's')), 'a bodyweight set has no load');
select lives_ok(format($$ select public.log_set(%L, public.india_today(), 2, 4, 6, null, 9) $$, (select v from ids where name = 's')), 'an extra set beyond the plan is fine');
select lives_ok(format($$ select public.log_set(%L, public.india_today(), 2, 2, 0, null, 10) $$, (select v from ids where name = 's')), 'and so is a set of zero reps, a failed attempt');

select throws_ok(format($$ select public.log_set(%L, public.india_today(), 1, 1, -1, 50, 7) $$, (select v from ids where name = 's')), '22023', 'bad_log', 'negative reps are refused');
select throws_ok(format($$ select public.log_set(%L, public.india_today(), 1, 1, 201, 50, 7) $$, (select v from ids where name = 's')), '22023', 'bad_log', 'more than 200 reps are refused');
select throws_ok(format($$ select public.log_set(%L, public.india_today(), 1, 1, 8, 500.01, 7) $$, (select v from ids where name = 's')), '22023', 'bad_log', 'a load over 500 kg is refused');
select throws_ok(format($$ select public.log_set(%L, public.india_today(), 1, 1, 8, 52.345, 7) $$, (select v from ids where name = 's')), '22023', 'bad_log', 'a load with three decimals is refused');
select throws_ok(format($$ select public.log_set(%L, public.india_today(), 1, 1, 8, -5, 7) $$, (select v from ids where name = 's')), '22023', 'bad_log', 'a negative load is refused');
select throws_ok(format($$ select public.log_set(%L, public.india_today(), 1, 1, 8, 50, 0) $$, (select v from ids where name = 's')), '22023', 'bad_log', 'effort below 1 is refused');
select throws_ok(format($$ select public.log_set(%L, public.india_today(), 1, 1, 8, 50, null) $$, (select v from ids where name = 's')), '22023', 'bad_log', 'effort is required');
select throws_ok(format($$ select public.log_set(%L, public.india_today(), 1, 21, 8, 50, 7) $$, (select v from ids where name = 's')), '22023', 'bad_log', 'set 21 is refused');
select throws_ok(format($$ select public.log_set(%L, public.india_today(), 3, 1, 8, 50, 7) $$, (select v from ids where name = 's')), '22023', 'bad_log', 'a rounds drill takes no sets');
select throws_ok(format($$ select public.log_set(%L, public.india_today() + 1, 1, 1, 8, 50, 7) $$, (select v from ids where name = 's')), '22023', 'not_scheduled', 'a future date is refused');
select throws_ok(format($$ insert into public.set_logs (item_log_id, set_no, reps, rpe) select id, 9, 8, 7 from public.item_logs limit 1 $$),
  '42501', null, 'clients cannot write sets directly');
select is(public.finish_session((select v from ids where name = 's')::uuid, public.india_today()), (select v from ids where name = 'log')::uuid, 'a session of sets finishes');

-- Readers.
select set_config('request.jwt.claims', '{"sub":"d3000000-0000-0000-0000-0000000000d1","role":"authenticated"}', true);
select is((select count(*)::int from public.set_logs), 0, 'another athlete reads none of the sets');
select set_config('request.jwt.claims', '{"sub":"b3000000-0000-0000-0000-0000000000b1","role":"authenticated"}', true);
select is((select count(*)::int from public.set_logs), 0, 'nor does another coach');
select set_config('request.jwt.claims', '{"sub":"a3000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
select is((select count(*)::int from public.set_logs), 6, 'Neha''s coach reads all six sets');

select set_config('request.jwt.claims', '{"sub":"c3000000-0000-0000-0000-0000000000c1","role":"authenticated"}', true);
select is((select jsonb_array_length(public.export_my_data() -> 'training_logs' -> 0 -> 'items' -> 0 -> 'sets')), 3, 'the data download lists the sets under each exercise');
select public.leave_program((select v from ids where name = 'e')::uuid);
select is((select count(*)::int from public.set_logs), 6, 'after leaving, Neha still reads her sets');
select set_config('request.jwt.claims', '{"sub":"a3000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
select is((select count(*)::int from public.set_logs), 0, 'and the coach reads none');

select * from finish();
rollback;
