-- M3-09: the session's real start time, and a note to the coach that saves with the session.
begin;
select plan(11);

insert into auth.users (id, email, email_confirmed_at) values
  ('a4000000-0000-0000-0000-0000000000a1', 'coach@t.test', now()),
  ('c4000000-0000-0000-0000-0000000000c1', 'kabir@t.test', now()),
  ('d4000000-0000-0000-0000-0000000000d1', 'neha@t.test', now());
insert into public.user_roles (user_id, role) values ('a4000000-0000-0000-0000-0000000000a1', 'coach');
update public.profiles set display_name = 'Kabir', date_of_birth = '1998-06-12' where id = 'c4000000-0000-0000-0000-0000000000c1';
update public.profiles set display_name = 'Neha', date_of_birth = '1996-02-02' where id = 'd4000000-0000-0000-0000-0000000000d1';
insert into public.athlete_basics (user_id, days_per_week) values ('c4000000-0000-0000-0000-0000000000c1', 3), ('d4000000-0000-0000-0000-0000000000d1', 3);

create temp table ids (name text primary key, v text);
grant all on ids to authenticated;
set local role authenticated;

select set_config('request.jwt.claims', '{"sub":"a4000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
insert into ids select 'p', public.create_program('Boxing Fundamentals', 'boxing');
select public.save_program_draft((select v from ids where name = 'p')::uuid, 'Boxing Fundamentals', '', 4, jsonb_build_array(
  jsonb_build_object('week', 1, 'day', 1, 'title', 'Jab', 'items', jsonb_build_array(
    jsonb_build_object('item', (select id from public.content_items where slug = 'jab'), 'type', 'rounds', 'rounds', 3, 'work_s', 120, 'rest_s', 60)))));
select public.publish_program((select v from ids where name = 'p')::uuid);
insert into ids select 'code', public.program_invite((select v from ids where name = 'p')::uuid);
reset role;
insert into ids select 's', s.id from public.program_sessions s join public.program_versions v on v.id = s.version_id
  where v.program_id = (select v from ids where name = 'p')::uuid and v.published_at is not null;
set local role authenticated;

select set_config('request.jwt.claims', '{"sub":"c4000000-0000-0000-0000-0000000000c1","role":"authenticated"}', true);
select public.join_program((select v from ids where name = 'code'));
insert into ids select 'log', public.log_drill((select v from ids where name = 's')::uuid, public.india_today(), 1, 3, 4, 7, '');

-- The player's open time becomes the start, when earlier than the first save and within six hours.
select public.finish_session((select v from ids where name = 's')::uuid, public.india_today(), now() - interval '36 minutes');
select is((select round(extract(epoch from completed_at - started_at) / 60)::int from public.session_logs), 36, 'the session took 36 minutes from opening the player');
select public.finish_session((select v from ids where name = 's')::uuid, public.india_today(), now() + interval '1 hour');
select is((select round(extract(epoch from completed_at - started_at) / 60)::int from public.session_logs), 36, 'a later open time does not move the start');
select public.finish_session((select v from ids where name = 's')::uuid, public.india_today(), now() - interval '3 days');
select is((select round(extract(epoch from completed_at - started_at) / 60)::int from public.session_logs), 360, 'an open time over six hours back counts as six hours');
select lives_ok(format($$ select public.finish_session(%L, public.india_today()) $$, (select v from ids where name = 's')), 'finishing without an open time still works');

-- The note.
select is(public.save_session_note((select v from ids where name = 's')::uuid, public.india_today(), '  Lead foot late on round 2.  '),
  (select v from ids where name = 'log')::uuid, 'saving the note returns the log');
select is((select note from public.session_logs), 'Lead foot late on round 2.', 'the note is saved, trimmed');
select throws_ok(format($$ select public.save_session_note(%L, public.india_today(), %L) $$, (select v from ids where name = 's'), repeat('x', 1001)),
  '22023', 'bad_note', 'a note over 1000 characters is refused');
select throws_ok(format($$ select public.save_session_note(%L, public.india_today() - 1, 'x') $$, (select v from ids where name = 's')),
  'P0002', 'no_log', 'a note needs a log for that date');

select set_config('request.jwt.claims', '{"sub":"d4000000-0000-0000-0000-0000000000d1","role":"authenticated"}', true);
select throws_ok(format($$ select public.save_session_note(%L, public.india_today(), 'hijack') $$, (select v from ids where name = 's')),
  'P0002', 'no_log', 'another athlete cannot write on Kabir''s log');
select set_config('request.jwt.claims', '{"sub":"a4000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
select is((select note from public.session_logs), 'Lead foot late on round 2.', 'the coach reads the note');
select throws_ok(format($$ select public.save_session_note(%L, public.india_today(), 'edited') $$, (select v from ids where name = 's')),
  'P0002', 'no_log', 'and cannot change it');

select * from finish();
rollback;
