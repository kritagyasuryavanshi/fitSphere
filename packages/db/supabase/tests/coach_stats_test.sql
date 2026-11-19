-- M4-05: a live coach's public stats from FitSphere records, compared with values worked out by hand.
begin;
select plan(10);

insert into auth.users (id, email, email_confirmed_at) values
  ('a8000000-0000-0000-0000-0000000000a1', 'cs-coach@t.test', now()),
  ('a8000000-0000-0000-0000-0000000000a2', 'cs-other@t.test', now()),
  ('b8000000-0000-0000-0000-000000000001', 'cs-1@t.test', now()),
  ('b8000000-0000-0000-0000-000000000002', 'cs-2@t.test', now()),
  ('b8000000-0000-0000-0000-000000000003', 'cs-3@t.test', now()),
  ('b8000000-0000-0000-0000-000000000004', 'cs-4@t.test', now()),
  ('b8000000-0000-0000-0000-000000000005', 'cs-5@t.test', now()),
  ('b8000000-0000-0000-0000-000000000006', 'cs-6@t.test', now());
insert into public.user_roles (user_id, role) values ('a8000000-0000-0000-0000-0000000000a1', 'coach'), ('a8000000-0000-0000-0000-0000000000a2', 'coach');
insert into public.coach_profiles (coach_id, headline, status, agreement_version) values
  ('a8000000-0000-0000-0000-0000000000a1', 'Boxing', 'live', public.current_coach_agreement()),
  ('a8000000-0000-0000-0000-0000000000a2', 'Boxing', 'draft', public.current_coach_agreement());

-- One program a week long, with sessions on days 1 and 3; the other coach has one too.
insert into public.programs (id, coach_id, category_id, title, weeks) values
  ('c8000000-0000-0000-0000-0000000000c1', 'a8000000-0000-0000-0000-0000000000a1', 'boxing', 'Fundamentals', 1),
  ('c8000000-0000-0000-0000-0000000000c2', 'a8000000-0000-0000-0000-0000000000a2', 'boxing', 'Other', 1);
insert into public.program_versions (id, program_id, version, published_at, effective_from, weeks, title, summary) values
  ('d8000000-0000-0000-0000-0000000000d1', 'c8000000-0000-0000-0000-0000000000c1', 1, now(), public.india_today() - 400, 1, 'Fundamentals', ''),
  ('d8000000-0000-0000-0000-0000000000d2', 'c8000000-0000-0000-0000-0000000000c2', 1, now(), public.india_today() - 400, 1, 'Other', '');
insert into public.program_sessions (id, version_id, week, day) values
  ('e8000000-0000-0000-0000-0000000000e1', 'd8000000-0000-0000-0000-0000000000d1', 1, 1),
  ('e8000000-0000-0000-0000-0000000000e3', 'd8000000-0000-0000-0000-0000000000d1', 1, 3);

-- 1: active for 100 days, the program is over (finished), both sessions done: 2 of 2.
-- 2: joined 2 days ago; day 1 (2 days ago) and day 3 (today) scheduled, day 1 done: 1 of 2. Too new for the 3-month count.
-- 3: left after 30 days, joined 120 days ago: did not stay 3 months.
-- 4: left after 95 days, joined 200 days ago: stayed.
-- 5: in the other coach's program: not counted.
insert into public.enrollments (program_id, athlete_id, status, start_date, joined_at, ended_at) values
  ('c8000000-0000-0000-0000-0000000000c1', 'b8000000-0000-0000-0000-000000000001', 'active', public.india_today() - 100, now() - interval '100 days', null),
  ('c8000000-0000-0000-0000-0000000000c1', 'b8000000-0000-0000-0000-000000000002', 'active', public.india_today() - 2, now() - interval '2 days', null),
  ('c8000000-0000-0000-0000-0000000000c1', 'b8000000-0000-0000-0000-000000000003', 'left', public.india_today() - 120, now() - interval '120 days', now() - interval '90 days'),
  ('c8000000-0000-0000-0000-0000000000c1', 'b8000000-0000-0000-0000-000000000004', 'left', public.india_today() - 200, now() - interval '200 days', now() - interval '105 days'),
  ('c8000000-0000-0000-0000-0000000000c2', 'b8000000-0000-0000-0000-000000000005', 'active', public.india_today() - 100, now() - interval '100 days', null);
insert into public.session_logs (athlete_id, program_id, session_id, on_date, category_id, completed_at) values
  ('b8000000-0000-0000-0000-000000000001', 'c8000000-0000-0000-0000-0000000000c1', 'e8000000-0000-0000-0000-0000000000e1', public.india_today() - 100, 'boxing', now()),
  ('b8000000-0000-0000-0000-000000000001', 'c8000000-0000-0000-0000-0000000000c1', 'e8000000-0000-0000-0000-0000000000e3', public.india_today() - 98, 'boxing', now()),
  ('b8000000-0000-0000-0000-000000000002', 'c8000000-0000-0000-0000-0000000000c1', 'e8000000-0000-0000-0000-0000000000e1', public.india_today() - 2, 'boxing', now()),
  -- Started, not finished: does not count as done.
  ('b8000000-0000-0000-0000-000000000002', 'c8000000-0000-0000-0000-0000000000c1', 'e8000000-0000-0000-0000-0000000000e3', public.india_today(), 'boxing', null);

set local role anon;
select is((select athletes from public.coach_stats('a8000000-0000-0000-0000-0000000000a1')), 4, 'athletes coached: every athlete who joined, left or not');
select is((select programs_finished from public.coach_stats('a8000000-0000-0000-0000-0000000000a1')), 1, 'programs finished: still enrolled after the last day');
select is((select stayed_pct from public.coach_stats('a8000000-0000-0000-0000-0000000000a1')), 67, 'stayed 3+ months: 2 of the 3 who joined 90+ days ago');
select is((select adherence_pct from public.coach_stats('a8000000-0000-0000-0000-0000000000a1')), null::int,
  'adherence stays hidden while fewer than 3 athletes count, so no single client''s number shows');

reset role;
-- 6: joined 2 days ago, nothing done: 0 of 2. Now 3 active athletes: 3 of 6 sessions done.
insert into public.enrollments (program_id, athlete_id, status, start_date, joined_at) values
  ('c8000000-0000-0000-0000-0000000000c1', 'b8000000-0000-0000-0000-000000000006', 'active', public.india_today() - 2, now() - interval '2 days');
set local role anon;
select is((select adherence_pct from public.coach_stats('a8000000-0000-0000-0000-0000000000a1')), 50, 'average adherence: 3 of 6 scheduled sessions done');
select is((select count(*)::int from public.coach_stats('a8000000-0000-0000-0000-0000000000a2')), 0, 'a coach who is not live has no stats');
select throws_ok($$ select * from public.coach_stats(null) $$, '22023', 'coach_needed', 'a coach is needed');

-- The portfolio's programs: published ones only, with how many are enrolled now.
reset role;
insert into public.programs (id, coach_id, category_id, title, weeks) values ('c8000000-0000-0000-0000-0000000000c3', 'a8000000-0000-0000-0000-0000000000a1', 'boxing', 'Unpublished draft', 4);
set local role anon;
select is((select string_agg(title || ':' || weeks || ':' || enrolled_now, ',') from public.coach_programs('a8000000-0000-0000-0000-0000000000a1')), 'Fundamentals:1:3',
  'published programs with title, weeks and athletes enrolled now');
select is((select count(*)::int from public.coach_programs('a8000000-0000-0000-0000-0000000000a2')), 0, 'none for a coach who is not live');
-- A published program only one client ever joined stays off the public profile: its title could name them.
reset role;
insert into public.programs (id, coach_id, category_id, title, weeks) values ('c8000000-0000-0000-0000-0000000000c4', 'a8000000-0000-0000-0000-0000000000a1', 'boxing', 'Priya comeback', 4);
insert into public.program_versions (program_id, version, published_at, effective_from, weeks, title, summary) values
  ('c8000000-0000-0000-0000-0000000000c4', 1, now(), public.india_today() - 10, 4, 'Priya comeback', '');
insert into public.enrollments (program_id, athlete_id, status, start_date) values ('c8000000-0000-0000-0000-0000000000c4', 'b8000000-0000-0000-0000-000000000003', 'active', public.india_today() - 10);
set local role anon;
select is((select string_agg(title, ',') from public.coach_programs('a8000000-0000-0000-0000-0000000000a1')), 'Fundamentals', 'a program fewer than 3 athletes joined is not listed');
select * from finish();
rollback;
