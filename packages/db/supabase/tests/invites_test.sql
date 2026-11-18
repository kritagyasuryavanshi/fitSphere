-- M3-03: invite links per program, reset, join, and the joined list.
begin;
select plan(15);

insert into auth.users (id, email, email_confirmed_at) values
  ('c0000000-0000-0000-0000-00000000000c', 'c@t.test', now()),
  ('d0000000-0000-0000-0000-00000000000d', 'd@t.test', now()),
  ('a0000000-0000-0000-0000-00000000000a', 'a@t.test', now()),
  ('b0000000-0000-0000-0000-00000000000b', 'b@t.test', now()),
  ('e0000000-0000-0000-0000-00000000000e', 'e@t.test', now());
insert into public.user_roles (user_id, role) values ('c0000000-0000-0000-0000-00000000000c', 'coach'), ('d0000000-0000-0000-0000-00000000000d', 'coach');
update public.profiles set display_name = 'Vikram' where id = 'c0000000-0000-0000-0000-00000000000c';
update public.profiles set display_name = 'Kabir', date_of_birth = '1998-06-12' where id = 'a0000000-0000-0000-0000-00000000000a';
insert into public.athlete_basics (user_id, days_per_week) values ('a0000000-0000-0000-0000-00000000000a', 3);
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
select lives_ok(format($$ select public.join_program(%L) $$, (select v from ids where name = 'code')), 'Kabir joins');
select lives_ok(format($$ select public.join_program(%L) $$, (select v from ids where name = 'code')), 'joining twice is fine');
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

select * from finish();
rollback;
