-- M4-05: a live coach's public stats from FitSphere records, compared with values worked out by hand.
begin;
select plan(9);

insert into auth.users (id, email, email_confirmed_at)
  select ('b8000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid, 'cs-' || n || '@t.test', now() from generate_series(1, 10) n;
insert into auth.users (id, email, email_confirmed_at) values
  ('a8000000-0000-0000-0000-0000000000a1', 'cs-coach@t.test', now()),
  ('a8000000-0000-0000-0000-0000000000a2', 'cs-other@t.test', now());
insert into public.user_roles (user_id, role) values ('a8000000-0000-0000-0000-0000000000a1', 'coach'), ('a8000000-0000-0000-0000-0000000000a2', 'coach');
insert into public.coach_profiles (coach_id, headline, status, agreement_version) values
  ('a8000000-0000-0000-0000-0000000000a1', 'Boxing', 'live', public.current_coach_agreement()),
  ('a8000000-0000-0000-0000-0000000000a2', 'Boxing', 'draft', public.current_coach_agreement());

-- One program a week long, with sessions on days 1 and 3 (2 scheduled per enrollment); the other coach has one too.
insert into public.programs (id, coach_id, category_id, title, weeks) values
  ('c8000000-0000-0000-0000-0000000000c1', 'a8000000-0000-0000-0000-0000000000a1', 'boxing', 'Fundamentals', 1),
  ('c8000000-0000-0000-0000-0000000000c2', 'a8000000-0000-0000-0000-0000000000a2', 'boxing', 'Other', 1);
insert into public.program_versions (id, program_id, version, published_at, effective_from, weeks, title, summary) values
  ('d8000000-0000-0000-0000-0000000000d1', 'c8000000-0000-0000-0000-0000000000c1', 1, now(), public.india_today() - 400, 1, 'Fundamentals', ''),
  ('d8000000-0000-0000-0000-0000000000d2', 'c8000000-0000-0000-0000-0000000000c2', 1, now(), public.india_today() - 400, 1, 'Other', '');
insert into public.program_sessions (id, version_id, week, day) values
  ('e8000000-0000-0000-0000-0000000000e1', 'd8000000-0000-0000-0000-0000000000d1', 1, 1),
  ('e8000000-0000-0000-0000-0000000000e3', 'd8000000-0000-0000-0000-0000000000d1', 1, 3);

create function pg_temp.athlete(n int) returns uuid language sql as $$ select ('b8000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid $$;
create function pg_temp.done(n int, day int, ago int) returns void language sql as $$
  insert into public.session_logs (athlete_id, program_id, session_id, on_date, category_id, completed_at)
  values (pg_temp.athlete(n), 'c8000000-0000-0000-0000-0000000000c1', case day when 1 then 'e8000000-0000-0000-0000-0000000000e1'::uuid else 'e8000000-0000-0000-0000-0000000000e3'::uuid end,
    public.india_today() - ago, 'boxing', now());
$$;
create function pg_temp.join(n int, ago int, status text default 'active', left_ago int default null) returns void language sql as $$
  insert into public.enrollments (program_id, athlete_id, status, start_date, joined_at, ended_at)
  values ('c8000000-0000-0000-0000-0000000000c1', pg_temp.athlete(n), status::public.enrollment_status, public.india_today() - ago,
    now() - make_interval(days => ago), case when left_ago is null then null else now() - make_interval(days => left_ago) end);
$$;

--      joined  status, left  sessions done   finished?            stayed 3+ months?
-- 1:   100     active        2 of 2          yes                  yes (100 days)
-- 2:   2       active        1 of 2          no, not over yet     too new to count
-- 3:   120     left at 90    0 of 2          no, none done        no (30 days)
-- 4:   200     left at 105   2 of 2          yes, then left       yes (95 days)
-- 6:   2       active        0 of 2          no, not over yet     too new to count
-- 7:   150     active        1 of 2          yes, half done       yes (150 days)
-- 8:   130     left at 125   1 of 2          no, left on day 5    no (5 days)
-- 5 is in the other coach's program and never counts.
select pg_temp.join(1, 100); select pg_temp.done(1, 1, 100); select pg_temp.done(1, 3, 98);
select pg_temp.join(2, 2); select pg_temp.done(2, 1, 2);
select pg_temp.join(3, 120, 'left', 90);
select pg_temp.join(4, 200, 'left', 105); select pg_temp.done(4, 1, 200); select pg_temp.done(4, 3, 198);
select pg_temp.join(6, 2);
select pg_temp.join(7, 150); select pg_temp.done(7, 1, 150);
select pg_temp.join(8, 130, 'left', 125); select pg_temp.done(8, 1, 130);
insert into public.enrollments (program_id, athlete_id, status, start_date) values ('c8000000-0000-0000-0000-0000000000c2', pg_temp.athlete(5), 'active', public.india_today() - 100);
-- Started, not finished: does not count as done.
insert into public.session_logs (athlete_id, program_id, session_id, on_date, category_id)
  values (pg_temp.athlete(2), 'c8000000-0000-0000-0000-0000000000c1', 'e8000000-0000-0000-0000-0000000000e3', public.india_today(), 'boxing');

set local role anon;
select is((select athletes from public.coach_stats('a8000000-0000-0000-0000-0000000000a1')), 7, 'athletes coached: every athlete who joined, left or not');
select is((select programs_finished from public.coach_stats('a8000000-0000-0000-0000-0000000000a1')), 3,
  'programs finished: ran past the last day with at least half the sessions done, left afterwards or not');
select is((select stayed_pct from public.coach_stats('a8000000-0000-0000-0000-0000000000a1')), 60, 'stayed 3+ months: 3 of the 5 who joined 90+ days ago, to the nearest 10%');
select is((select adherence_pct from public.coach_stats('a8000000-0000-0000-0000-0000000000a1')), null::int,
  'adherence stays hidden while fewer than 5 athletes count');

reset role;
-- 9: joined 2 days ago, nothing done. 10: joined 100 days ago, still enrolled, never trained.
select pg_temp.join(9, 2);
select pg_temp.join(10, 100);
set local role anon;
select is((select programs_finished from public.coach_stats('a8000000-0000-0000-0000-0000000000a1')), 3, 'enrolled to the end without training is not finishing');
-- 6 active athletes: 4 of 12 scheduled sessions done is 33%, shown as 30%.
select is((select adherence_pct from public.coach_stats('a8000000-0000-0000-0000-0000000000a1')), 30, 'average adherence: 4 of 12, to the nearest 10%');
-- 4 of the 6 who joined 90+ days ago stayed: 67%, shown as 70%.
select is((select stayed_pct from public.coach_stats('a8000000-0000-0000-0000-0000000000a1')), 70, 'stayed 3+ months: 4 of 6, to the nearest 10%');
select is((select count(*)::int from public.coach_stats('a8000000-0000-0000-0000-0000000000a2')), 0, 'a coach who is not live has no stats');
select throws_ok($$ select * from public.coach_stats(null) $$, '22023', 'coach_needed', 'a coach is needed');

select * from finish();
rollback;
