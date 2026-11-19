-- Fixes from the M3 review: a coach reads a program's logs only while the athlete is in that program; the data
-- download shows the published title, not the coach's draft; a prescription keeps only its own numbers; and only
-- the coach and the program's athletes read a program's versions, sessions and drills.
begin;
select plan(12);

insert into auth.users (id, email, email_confirmed_at) values
  ('a7000000-0000-0000-0000-0000000000a1', 'coach-r@t.test', now()),
  ('c7000000-0000-0000-0000-0000000000c1', 'kabir-r@t.test', now()),
  ('d7000000-0000-0000-0000-0000000000d1', 'neha-r@t.test', now());
insert into public.user_roles (user_id, role) values ('a7000000-0000-0000-0000-0000000000a1', 'coach');
update public.profiles set display_name = 'Kabir', date_of_birth = '1998-06-12' where id = 'c7000000-0000-0000-0000-0000000000c1';
update public.profiles set display_name = 'Neha', date_of_birth = '1996-02-02' where id = 'd7000000-0000-0000-0000-0000000000d1';
insert into public.athlete_basics (user_id, days_per_week) values ('c7000000-0000-0000-0000-0000000000c1', 3), ('d7000000-0000-0000-0000-0000000000d1', 3);

create temp table ids (name text primary key, v text);
grant all on ids to authenticated, anon;
set local role authenticated;

-- One coach, two boxing programs, each with a timed drill on day 1.
select set_config('request.jwt.claims', '{"sub":"a7000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
insert into ids select 'p1', public.create_program('Ring One', 'boxing');
insert into ids select 'p2', public.create_program('Ring Two', 'boxing');
select public.save_program_draft((select v from ids where name = n)::uuid, t, '', 4, jsonb_build_array(
  jsonb_build_object('week', 1, 'day', 1, 'title', 'Engine', 'items', jsonb_build_array(
    jsonb_build_object('item', (select id from public.content_items where slug = 'skipping'), 'type', 'time', 'seconds', 300)))))
from (values ('p1', 'Ring One'), ('p2', 'Ring Two')) x (n, t);
select public.publish_program((select v from ids where name = n)::uuid) from (values ('p1'), ('p2')) x (n);
insert into ids select 'c1', public.program_invite((select v from ids where name = 'p1')::uuid);
insert into ids select 'c2', public.program_invite((select v from ids where name = 'p2')::uuid);

select throws_ok(format($$ select public.save_program_draft(%L, 'Ring One', '', 4, jsonb_build_array(jsonb_build_object('week', 1, 'day', 1, 'items',
    jsonb_build_array(jsonb_build_object('item', (select id from public.content_items where slug = 'skipping'), 'type', 'time', 'seconds', 300, 'blob', 'x'))))) $$,
  (select v from ids where name = 'p1')), '22023', 'bad_prescription', 'a prescription with a key it does not use is refused');
select throws_ok(format($$ select public.save_program_draft(%L, 'Ring One', '', 4, jsonb_build_array(jsonb_build_object('week', 1, 'day', 1, 'items',
    jsonb_build_array(jsonb_build_object('item', (select id from public.content_items where slug = 'skipping'), 'type', 'time', 'seconds', 300, 'rounds', 3))))) $$,
  (select v from ids where name = 'p1')), '22023', 'bad_prescription', 'nor a number from another drill type');

-- Kabir joins both and does day 1 of each today.
select set_config('request.jwt.claims', '{"sub":"c7000000-0000-0000-0000-0000000000c1","role":"authenticated"}', true);
insert into ids select 'e1', public.join_program((select v from ids where name = 'c1'));
select public.join_program((select v from ids where name = 'c2'));
reset role;
insert into ids select 's' || right(x.n, 1), s.id from (values ('p1'), ('p2')) x (n)
  join public.program_versions v on v.program_id = (select v from ids where name = x.n)::uuid and v.published_at is not null
  join public.program_sessions s on s.version_id = v.id;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"c7000000-0000-0000-0000-0000000000c1","role":"authenticated"}', true);
select public.log_drill((select v from ids where name = n)::uuid, public.india_today(), 1, null, 4, 6, '') from (values ('s1'), ('s2')) x (n);

select set_config('request.jwt.claims', '{"sub":"a7000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
select is((select count(*)::int from public.session_logs), 2, 'the coach reads both logs while Kabir is in both programs');
-- The coach renames Ring Two's draft and does not publish.
select public.save_program_draft((select v from ids where name = 'p2')::uuid, 'Secret draft name', '', 4, jsonb_build_array(
  jsonb_build_object('week', 1, 'day', 1, 'title', 'Engine', 'items', jsonb_build_array(
    jsonb_build_object('item', (select id from public.content_items where slug = 'skipping'), 'type', 'time', 'seconds', 300)))));

-- Kabir leaves Ring One and stays in Ring Two.
select set_config('request.jwt.claims', '{"sub":"c7000000-0000-0000-0000-0000000000c1","role":"authenticated"}', true);
select public.leave_program((select v from ids where name = 'e1')::uuid);
select is((select string_agg(x ->> 'program', ',' order by x ->> 'program') from jsonb_array_elements(public.export_my_data() -> 'programs') x),
  'Ring One,Ring Two', 'the data download shows the published titles, not the coach''s draft');
select is((select count(*)::int from public.program_versions where program_id = (select v from ids where name = 'p2')::uuid), 1,
  'Kabir reads the published version of his program');

select set_config('request.jwt.claims', '{"sub":"a7000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
select is((select count(*)::int from public.session_logs), 1, 'after he leaves Ring One, the coach reads only the Ring Two log');
select is((select count(*)::int from public.session_logs where program_id = (select v from ids where name = 'p1')::uuid), 0, 'and none from Ring One');
select is((select scheduled from public.adherence('c7000000-0000-0000-0000-0000000000c1', (select v from ids where name = 'p1')::uuid)), 0,
  'and no adherence for Ring One');

-- Neha is in neither program, and a guest is not signed in.
select set_config('request.jwt.claims', '{"sub":"d7000000-0000-0000-0000-0000000000d1","role":"authenticated"}', true);
select is((select count(*)::int from public.program_versions), 0, 'someone outside the programs reads no versions');
select is((select count(*)::int from public.program_sessions) + (select count(*)::int from public.session_items), 0, 'nor their sessions and drills');
select is((select count(*)::int from public.invite_info((select v from ids where name = 'c2'))), 1, 'but the invite link still shows the program');
reset role;
set local role anon;
select is((select count(*)::int from public.program_versions), 0, 'a guest reads no versions');

select * from finish();
rollback;
