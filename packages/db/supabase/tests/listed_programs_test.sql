-- M4-05b: a program shows on the coach's public profile only after the coach chooses to list it.
begin;
select plan(9);

insert into auth.users (id, email, email_confirmed_at) values
  ('ae000000-0000-0000-0000-0000000000c1', 'lp-coach@t.test', now()),
  ('ae000000-0000-0000-0000-0000000000c2', 'lp-other@t.test', now());
insert into public.user_roles (user_id, role) values ('ae000000-0000-0000-0000-0000000000c1', 'coach'), ('ae000000-0000-0000-0000-0000000000c2', 'coach');
insert into public.coach_profiles (coach_id, headline, status, agreement_version) values
  ('ae000000-0000-0000-0000-0000000000c1', 'Boxing', 'live', public.current_coach_agreement());
insert into public.programs (id, coach_id, category_id, title, weeks) values
  ('af000000-0000-0000-0000-0000000000f1', 'ae000000-0000-0000-0000-0000000000c1', 'boxing', 'Fundamentals', 6),
  ('af000000-0000-0000-0000-0000000000f2', 'ae000000-0000-0000-0000-0000000000c1', 'boxing', 'Draft only', 4);
insert into public.program_versions (program_id, version, published_at, effective_from, weeks, title, summary) values
  ('af000000-0000-0000-0000-0000000000f1', 1, now(), current_date, 6, 'Boxing Fundamentals', '');
insert into public.program_versions (program_id, version) values ('af000000-0000-0000-0000-0000000000f2', 1);
-- Four athletes in Fundamentals now.
insert into auth.users (id, email, email_confirmed_at)
  select ('b0000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid, 'lp-' || n || '@t.test', now() from generate_series(1, 7) n;
insert into public.enrollments (program_id, athlete_id, start_date)
  select 'af000000-0000-0000-0000-0000000000f1', ('b0000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid, current_date from generate_series(1, 4) n;

create function pg_temp.as_user(uid text) returns void language sql as $$ select set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated"}', uid), true) $$;

set local role anon;
select is((select count(*)::int from public.coach_programs('ae000000-0000-0000-0000-0000000000c1')), 0, 'no program shows until the coach lists it');

set local role authenticated;
select pg_temp.as_user('ae000000-0000-0000-0000-0000000000c2');
select throws_ok($$ select public.set_program_listed('af000000-0000-0000-0000-0000000000f1', true) $$, '42501', 'not_owner', 'only the program''s coach can list it');
select pg_temp.as_user('ae000000-0000-0000-0000-0000000000c1');
select throws_ok($$ select public.set_program_listed('af000000-0000-0000-0000-0000000000f2', true) $$, '22023', 'not_published', 'an unpublished program cannot be listed');
select lives_ok($$ select public.set_program_listed('af000000-0000-0000-0000-0000000000f1', true) $$, 'the coach lists a published program');

set local role anon;
select is((select title || ':' || weeks from public.coach_programs('ae000000-0000-0000-0000-0000000000c1')), 'Boxing Fundamentals:6',
  'a listed program shows its published title and weeks');
select is((select enrolled_band from public.coach_programs('ae000000-0000-0000-0000-0000000000c1')), null::int, 'the enrolled count stays hidden below 5 athletes');
reset role;
insert into public.enrollments (program_id, athlete_id, start_date) values ('af000000-0000-0000-0000-0000000000f1', 'b0000000-0000-0000-0000-000000000005', current_date);
set local role anon;
select is((select enrolled_band from public.coach_programs('ae000000-0000-0000-0000-0000000000c1')), 5, 'and shows from 5');
-- In bands of 5, so one athlete joining or leaving does not show.
reset role;
insert into public.enrollments (program_id, athlete_id, start_date)
  select 'af000000-0000-0000-0000-0000000000f1', ('b0000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid, current_date from generate_series(6, 7) n;
set local role anon;
select is((select enrolled_band from public.coach_programs('ae000000-0000-0000-0000-0000000000c1')), 5, '7 athletes still show as 5 or more');

reset role;
update public.coach_profiles set status = 'draft' where coach_id = 'ae000000-0000-0000-0000-0000000000c1';
set local role anon;
select is((select count(*)::int from public.coach_programs('ae000000-0000-0000-0000-0000000000c1')), 0, 'nothing shows for a coach who is not live');

select * from finish();
rollback;
