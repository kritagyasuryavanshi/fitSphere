-- M3-07: session logs. The athlete writes their own, for sessions their programs schedule; a coach reads them only
-- through coach_can_read, and only for programs they own.
begin;
select plan(30);

insert into auth.users (id, email, email_confirmed_at) values
  ('a2000000-0000-0000-0000-0000000000a1', 'coach-a@t.test', now()),
  ('b2000000-0000-0000-0000-0000000000b1', 'coach-b@t.test', now()),
  ('c2000000-0000-0000-0000-0000000000c1', 'kabir@t.test', now()),
  ('d2000000-0000-0000-0000-0000000000d1', 'neha@t.test', now()),
  ('e2000000-0000-0000-0000-0000000000e1', 'ravi@t.test', now());
insert into public.user_roles (user_id, role) values ('a2000000-0000-0000-0000-0000000000a1', 'coach'), ('b2000000-0000-0000-0000-0000000000b1', 'coach');
update public.profiles set display_name = 'Kabir', date_of_birth = '1998-06-12' where id = 'c2000000-0000-0000-0000-0000000000c1';
update public.profiles set display_name = 'Neha', date_of_birth = '1996-02-02' where id = 'd2000000-0000-0000-0000-0000000000d1';
update public.profiles set display_name = 'Ravi', date_of_birth = '1995-03-03' where id = 'e2000000-0000-0000-0000-0000000000e1';
insert into public.athlete_basics (user_id, days_per_week) values
  ('c2000000-0000-0000-0000-0000000000c1', 3), ('d2000000-0000-0000-0000-0000000000d1', 3), ('e2000000-0000-0000-0000-0000000000e1', 3);

create temp table ids (name text primary key, v text);
grant all on ids to authenticated, anon;
set local role authenticated;

-- Coach A: boxing, day 1 "Jab" (3 rounds of 2:00, then 10 minutes of skipping), day 2 "Pads".
select set_config('request.jwt.claims', '{"sub":"a2000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
insert into ids select 'pa', public.create_program('Boxing Fundamentals', 'boxing');
select public.save_program_draft((select v from ids where name = 'pa')::uuid, 'Boxing Fundamentals', '', 4, jsonb_build_array(
  jsonb_build_object('week', 1, 'day', 1, 'title', 'Jab', 'items', jsonb_build_array(
    jsonb_build_object('item', (select id from public.content_items where slug = 'jab'), 'type', 'rounds', 'rounds', 3, 'work_s', 120, 'rest_s', 60),
    jsonb_build_object('item', (select id from public.content_items where slug = 'skipping'), 'type', 'time', 'seconds', 600))),
  jsonb_build_object('week', 1, 'day', 2, 'title', 'Pads', 'items', jsonb_build_array(
    jsonb_build_object('item', (select id from public.content_items where slug = 'jab'), 'type', 'rounds', 'rounds', 2, 'work_s', 60, 'rest_s', 30)))));
select public.publish_program((select v from ids where name = 'pa')::uuid);
insert into ids select 'ca', public.program_invite((select v from ids where name = 'pa')::uuid);

-- Coach B: one boxing day.
select set_config('request.jwt.claims', '{"sub":"b2000000-0000-0000-0000-0000000000b1","role":"authenticated"}', true);
insert into ids select 'pb', public.create_program('Ring Engine', 'boxing');
select public.save_program_draft((select v from ids where name = 'pb')::uuid, 'Ring Engine', '', 4, jsonb_build_array(
  jsonb_build_object('week', 1, 'day', 1, 'title', 'Engine', 'items', jsonb_build_array(
    jsonb_build_object('item', (select id from public.content_items where slug = 'skipping'), 'type', 'time', 'seconds', 300)))));
select public.publish_program((select v from ids where name = 'pb')::uuid);
insert into ids select 'cb', public.program_invite((select v from ids where name = 'pb')::uuid);

-- Kabir joins both, Neha joins B, Ravi joins A.
select set_config('request.jwt.claims', '{"sub":"c2000000-0000-0000-0000-0000000000c1","role":"authenticated"}', true);
insert into ids select 'ek', public.join_program((select v from ids where name = 'ca'));
select public.join_program((select v from ids where name = 'cb'));
select set_config('request.jwt.claims', '{"sub":"d2000000-0000-0000-0000-0000000000d1","role":"authenticated"}', true);
select public.join_program((select v from ids where name = 'cb'));
select set_config('request.jwt.claims', '{"sub":"e2000000-0000-0000-0000-0000000000e1","role":"authenticated"}', true);
insert into ids select 'er', public.join_program((select v from ids where name = 'ca'));

-- Kabir started on program A yesterday: day 1 was yesterday, day 2 is today.
reset role;
update public.enrollments set start_date = public.india_today() - 1 where id = (select v from ids where name = 'ek')::uuid;
insert into ids select 'd1', s.id from public.program_sessions s join public.program_versions v on v.id = s.version_id
  where v.program_id = (select v from ids where name = 'pa')::uuid and v.published_at is not null and s.day = 1;
insert into ids select 'd2', s.id from public.program_sessions s join public.program_versions v on v.id = s.version_id
  where v.program_id = (select v from ids where name = 'pa')::uuid and v.published_at is not null and s.day = 2;
insert into ids select 'draft', s.id from public.program_sessions s join public.program_versions v on v.id = s.version_id
  where v.program_id = (select v from ids where name = 'pa')::uuid and v.published_at is null and s.day = 1;
insert into ids select 'b1', s.id from public.program_sessions s join public.program_versions v on v.id = s.version_id
  where v.program_id = (select v from ids where name = 'pb')::uuid and v.published_at is not null;
set local role authenticated;

-- Kabir logs yesterday's session late, drill by drill.
select set_config('request.jwt.claims', '{"sub":"c2000000-0000-0000-0000-0000000000c1","role":"authenticated"}', true);
insert into ids select 'log', public.log_drill((select v from ids where name = 'd1')::uuid, public.india_today() - 1, 1, 2, 4, 7, 'Lead foot late.');
select is((select title || '|' || category_id || '|' || (completed_at is null)::text from public.session_logs where id = (select v from ids where name = 'log')::uuid),
  'Jab|boxing|true', 'the first drill opens a log with the session''s title and sport, not yet finished');
select is((select rounds_done || '/' || rounds_planned || '|' || technique || '|' || effort || '|' || note from public.item_logs where log_id = (select v from ids where name = 'log')::uuid),
  '2/3|4|7|Lead foot late.', 'the drill log keeps rounds done of planned, technique, effort and the note');
select is(public.log_drill((select v from ids where name = 'd1')::uuid, public.india_today() - 1, 1, 3, 5, 8, ''), (select v from ids where name = 'log')::uuid,
  'logging the same drill again returns the same log');
select is((select count(*)::int || '|' || min(rounds_done) || '|' || min(technique) from public.item_logs where log_id = (select v from ids where name = 'log')::uuid),
  '1|3|5', 'and replaces the drill log instead of adding one');
select lives_ok(format($$ select public.log_drill(%L, public.india_today() - 1, 2, null, 3, 6, '') $$, (select v from ids where name = 'd1')),
  'a timed drill logs without rounds');
select is((select rounds_done is null and rounds_planned is null from public.item_logs where log_id = (select v from ids where name = 'log')::uuid and position = 2),
  true, 'and stores no rounds');

-- Bad numbers and unscheduled sessions are refused.
select throws_ok(format($$ select public.log_drill(%L, public.india_today() - 1, 1, 4, 4, 7, '') $$, (select v from ids where name = 'd1')), '22023', 'bad_log', 'more rounds than planned is refused');
select throws_ok(format($$ select public.log_drill(%L, public.india_today() - 1, 1, -1, 4, 7, '') $$, (select v from ids where name = 'd1')), '22023', 'bad_log', 'negative rounds are refused');
select throws_ok(format($$ select public.log_drill(%L, public.india_today() - 1, 1, null, 4, 7, '') $$, (select v from ids where name = 'd1')), '22023', 'bad_log', 'a rounds drill needs rounds done');
select throws_ok(format($$ select public.log_drill(%L, public.india_today() - 1, 1, 2, 6, 7, '') $$, (select v from ids where name = 'd1')), '22023', 'bad_log', 'technique above 5 is refused');
select throws_ok(format($$ select public.log_drill(%L, public.india_today() - 1, 1, 2, 4, 0, '') $$, (select v from ids where name = 'd1')), '22023', 'bad_log', 'effort below 1 is refused');
select throws_ok(format($$ select public.log_drill(%L, public.india_today() - 1, 9, 2, 4, 7, '') $$, (select v from ids where name = 'd1')), '22023', 'bad_log', 'a drill that is not in the session is refused');
select throws_ok(format($$ select public.log_drill(%L, public.india_today() - 1, 1, 2, 4, 7, %L) $$, (select v from ids where name = 'd1'), repeat('x', 501)), '22023', 'bad_log', 'a note over 500 characters is refused');
select throws_ok(format($$ select public.log_drill(%L, public.india_today(), 1, 2, 4, 7, '') $$, (select v from ids where name = 'd1')), '22023', 'not_scheduled', 'day 1 cannot be logged on day 2''s date');
select throws_ok(format($$ select public.log_drill(%L, public.india_today() + 6, 1, 2, 4, 7, '') $$, (select v from ids where name = 'd1')), '22023', 'not_scheduled', 'nor a future date');
select throws_ok(format($$ select public.log_drill(%L, public.india_today() - 1, 1, 2, 4, 7, '') $$, (select v from ids where name = 'draft')), '22023', 'not_scheduled', 'nor a session in the coach''s unpublished draft');
select throws_ok(format($$ insert into public.session_logs (athlete_id, on_date, category_id) values (%L, public.india_today(), 'boxing') $$, 'c2000000-0000-0000-0000-0000000000c1'),
  '42501', null, 'clients cannot write logs directly');

-- Finishing.
select throws_ok(format($$ select public.finish_session(%L, public.india_today()) $$, (select v from ids where name = 'd2')), '22023', 'nothing_logged', 'a session with no drill logged cannot be finished');
select is(public.finish_session((select v from ids where name = 'd1')::uuid, public.india_today() - 1), (select v from ids where name = 'log')::uuid, 'finishing returns the log');
select is((select completed_at is not null from public.session_logs where id = (select v from ids where name = 'log')::uuid), true, 'and marks it completed');
insert into ids select 'logb', public.log_drill((select v from ids where name = 'b1')::uuid, public.india_today(), 1, null, 4, 6, 'B only');

-- Other people.
select set_config('request.jwt.claims', '{"sub":"d2000000-0000-0000-0000-0000000000d1","role":"authenticated"}', true);
select throws_ok(format($$ select public.log_drill(%L, public.india_today() - 1, 1, 2, 4, 7, '') $$, (select v from ids where name = 'd1')), '22023', 'not_scheduled', 'Neha cannot log a session from a program she is not in');
select is((select count(*)::int from public.session_logs) + (select count(*)::int from public.item_logs), 0, 'and sees none of Kabir''s logs');

select set_config('request.jwt.claims', '{"sub":"a2000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
select is((select count(*)::int from public.session_logs where athlete_id = 'c2000000-0000-0000-0000-0000000000c1'), 1, 'coach A reads Kabir''s log in program A');
select is((select count(*)::int from public.item_logs), 2, 'and its drill logs');
select set_config('request.jwt.claims', '{"sub":"b2000000-0000-0000-0000-0000000000b1","role":"authenticated"}', true);
select is((select string_agg(note, ',') from public.item_logs), 'B only', 'coach B reads only the log from program B, not coach A''s');

-- Ravi logs, then coach A removes him.
select set_config('request.jwt.claims', '{"sub":"e2000000-0000-0000-0000-0000000000e1","role":"authenticated"}', true);
select public.log_drill((select v from ids where name = 'd1')::uuid, public.india_today(), 1, 3, 3, 9, '');
select set_config('request.jwt.claims', '{"sub":"a2000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
select public.remove_athlete((select v from ids where name = 'er')::uuid);
select is((select count(*)::int from public.session_logs where athlete_id = 'e2000000-0000-0000-0000-0000000000e1'), 0, 'after removal, the coach reads none of Ravi''s logs');

-- Kabir leaves program A.
select set_config('request.jwt.claims', '{"sub":"c2000000-0000-0000-0000-0000000000c1","role":"authenticated"}', true);
select public.leave_program((select v from ids where name = 'ek')::uuid);
select throws_ok(format($$ select public.log_drill(%L, public.india_today() - 1, 1, 2, 4, 7, '') $$, (select v from ids where name = 'd1')), '22023', 'not_scheduled', 'after leaving, Kabir cannot log program A');
select is((select count(*)::int from public.session_logs), 2, 'but keeps reading all his own logs');
select is(jsonb_array_length(public.export_my_data() -> 'training_logs'), 2, 'and his data download lists them');
select set_config('request.jwt.claims', '{"sub":"a2000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
select is((select count(*)::int from public.session_logs) + (select count(*)::int from public.item_logs), 0, 'after he leaves, coach A reads none of his logs');

select * from finish();
rollback;
