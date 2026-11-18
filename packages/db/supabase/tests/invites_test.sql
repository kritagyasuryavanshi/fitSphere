-- M3-03: invite links per program, reset, join, and the joined list.
begin;
select plan(25);

insert into auth.users (id, email, email_confirmed_at) values
  ('c0000000-0000-0000-0000-00000000000c', 'c@t.test', now()),
  ('d0000000-0000-0000-0000-00000000000d', 'd@t.test', now()),
  ('a0000000-0000-0000-0000-00000000000a', 'a@t.test', now()),
  ('b0000000-0000-0000-0000-00000000000b', 'b@t.test', now()),
  ('e0000000-0000-0000-0000-00000000000e', 'e@t.test', now()),
  ('f0000000-0000-0000-0000-00000000000f', 'f@t.test', now());
insert into public.user_roles (user_id, role) values ('c0000000-0000-0000-0000-00000000000c', 'coach'), ('d0000000-0000-0000-0000-00000000000d', 'coach');
update public.profiles set display_name = 'Vikram' where id = 'c0000000-0000-0000-0000-00000000000c';
update public.profiles set display_name = 'Kabir', date_of_birth = '1998-06-12' where id = 'a0000000-0000-0000-0000-00000000000a';
-- Kabir, F and the coach have finished sign-up.
update public.profiles set date_of_birth = '1990-03-03' where id in ('f0000000-0000-0000-0000-00000000000f', 'c0000000-0000-0000-0000-00000000000c');
insert into public.athlete_basics (user_id, days_per_week) values
  ('a0000000-0000-0000-0000-00000000000a', 3), ('f0000000-0000-0000-0000-00000000000f', 3), ('c0000000-0000-0000-0000-00000000000c', 3);
-- E finished step 1 (date of birth) but not step 2 (basics).
update public.profiles set date_of_birth = '1995-01-01' where id = 'e0000000-0000-0000-0000-00000000000e';

create temp table ids (name text primary key, v text);
grant all on ids to authenticated, anon;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"c0000000-0000-0000-0000-00000000000c","role":"authenticated"}', true);
insert into ids select 'p', public.create_program('Boxing Fundamentals', 'boxing');
select public.save_program_draft((select v from ids where name = 'p')::uuid, 'Boxing Fundamentals', '', 6,
  jsonb_build_array(jsonb_build_object('week', 1, 'day', 1, 'title', 'Jab', 'items', '[]'::jsonb)));

insert into ids select 'code', public.program_invite((select v from ids where name = 'p')::uuid);
select ok((select v from ids where name = 'code') ~ '^[0-9a-f]{32}$', 'the code is 32 random hex characters');
select is(public.program_invite((select v from ids where name = 'p')::uuid), (select v from ids where name = 'code'), 'asking again returns the same active code');

-- Kabir cannot join before the program is published.
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select throws_ok(format($$ select public.join_program(%L) $$, (select v from ids where name = 'code')), '22023', 'not_published', 'an unpublished program cannot be joined');

select set_config('request.jwt.claims', '{"sub":"c0000000-0000-0000-0000-00000000000c","role":"authenticated"}', true);
select public.publish_program((select v from ids where name = 'p')::uuid);

-- A guest sees what the link is for.
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select is((select title || '|' || coach_name || '|' || active::text from public.invite_info((select v from ids where name = 'code'))), 'Boxing Fundamentals|Vikram|true', 'the invite page shows the program and coach');
select throws_ok(format($$ select public.join_program(%L) $$, (select v from ids where name = 'code')), '42501', null, 'a guest must sign in to join');

-- B has not started sign-up, E stopped after step 1; Kabir has finished.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"b0000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
select throws_ok(format($$ select public.join_program(%L) $$, (select v from ids where name = 'code')), '22023', 'step1_required', 'joining needs a finished sign-up');
select set_config('request.jwt.claims', '{"sub":"e0000000-0000-0000-0000-00000000000e","role":"authenticated"}', true);
select throws_ok(format($$ select public.join_program(%L) $$, (select v from ids where name = 'code')), '22023', 'signup_unfinished', 'step 1 alone is not a finished sign-up');
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select lives_ok(format($$ insert into ids select 'e', public.join_program(%L) $$, (select v from ids where name = 'code')), 'Kabir joins');
select is(public.join_program((select v from ids where name = 'code'))::text, (select v from ids where name = 'e'), 'joining twice returns the same enrollment');
select is((select count(*)::int || '|' || min(start_date)::text from public.enrollments where status = 'active'), '1|' || public.india_today()::text, 'one active enrollment, starting today in India');

-- The coach sees who joined; another coach does not.
select set_config('request.jwt.claims', '{"sub":"c0000000-0000-0000-0000-00000000000c","role":"authenticated"}', true);
select is((select array_agg(display_name) from public.program_members((select v from ids where name = 'p')::uuid)), array['Kabir'], 'the coach sees each person who joined');
select set_config('request.jwt.claims', '{"sub":"d0000000-0000-0000-0000-00000000000d","role":"authenticated"}', true);
select throws_ok(format($$ select * from public.program_members(%L) $$, (select v from ids where name = 'p')), '42501', 'not_owner', 'another coach cannot list them');

-- Reset: the old link stops working; Kabir stays in.
select set_config('request.jwt.claims', '{"sub":"c0000000-0000-0000-0000-00000000000c","role":"authenticated"}', true);
insert into ids select 'new', public.reset_invite((select v from ids where name = 'p')::uuid);
select isnt((select v from ids where name = 'new'), (select v from ids where name = 'code'), 'reset makes a new code');
select is((select active from public.invite_info((select v from ids where name = 'code'))), false, 'the old link is no longer active');
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select is((select count(*)::int from public.enrollments where status = 'active'), 1, 'people who joined stay in the program');
select is(jsonb_array_length(public.export_my_data() -> 'programs'), 1, 'the data download lists the programs joined');

-- The old code admits nobody new, and says nothing about the program any more.
select set_config('request.jwt.claims', '{"sub":"f0000000-0000-0000-0000-00000000000f","role":"authenticated"}', true);
select throws_ok(format($$ select public.join_program(%L) $$, (select v from ids where name = 'code')), '22023', 'invite_inactive', 'the old link no longer admits anyone');
select is((select coalesce(title, '') || '|' || active::text from public.invite_info((select v from ids where name = 'code'))), '|false', 'a reset link shows only that it is inactive');

-- A coach cannot join their own program.
select set_config('request.jwt.claims', '{"sub":"c0000000-0000-0000-0000-00000000000c","role":"authenticated"}', true);
select throws_ok(format($$ select public.join_program(%L) $$, (select v from ids where name = 'new')), '22023', 'own_program', 'a coach cannot join their own program');

-- Removed: Kabir cannot rejoin, and the coach no longer sees him.
reset role;
update public.enrollments set status = 'removed', ended_at = now() where id = (select v from ids where name = 'e')::uuid;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select throws_ok(format($$ select public.join_program(%L) $$, (select v from ids where name = 'new')), '22023', 'removed_from_program', 'a removed athlete cannot rejoin through the link');
select set_config('request.jwt.claims', '{"sub":"c0000000-0000-0000-0000-00000000000c","role":"authenticated"}', true);
select is((select count(*)::int from public.program_members((select v from ids where name = 'p')::uuid)), 0, 'the joined list shows active members only');
select is((select count(*)::int from public.enrollments), 0, 'the coach cannot read enrollments that ended');

-- Without the coach role, the owner cannot list members.
reset role;
delete from public.user_roles where user_id = 'c0000000-0000-0000-0000-00000000000c' and role = 'coach';
set local role authenticated;
select throws_ok(format($$ select * from public.program_members(%L) $$, (select v from ids where name = 'p')), '42501', 'not_owner', 'a former coach cannot list members');

-- The coach deleted their account: the program stays for those enrolled, but the link closes.
reset role;
update public.programs set coach_id = null where id = (select v from ids where name = 'p')::uuid;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"f0000000-0000-0000-0000-00000000000f","role":"authenticated"}', true);
select throws_ok(format($$ select public.join_program(%L) $$, (select v from ids where name = 'new')), '22023', 'invite_inactive', 'nobody joins a program whose coach left');
select is((select active from public.invite_info((select v from ids where name = 'new'))), false, 'and its link shows as inactive');

select * from finish();
rollback;
