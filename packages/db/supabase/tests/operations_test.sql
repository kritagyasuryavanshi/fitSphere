-- M6-12: each daily job records how it ended, jobs_overdue names the jobs that failed or have not run for over a
-- day, and prune_email_outbox drops email rows older than 90 days. Only the service role may touch any of it.
begin;
select plan(11);

-- A job that never ran is overdue.
select results_eq($$ select job from public.jobs_overdue() order by job $$, array['check-videos', 'send-emails'], 'both jobs are overdue before any run');

select public.record_job('send-emails', true, null);
select public.record_job('check-videos', true, null);
select is_empty($$ select * from public.jobs_overdue() $$, 'nothing is overdue after both ran');

-- A failure is overdue at once, and keeps the error.
select public.record_job('check-videos', false, 'Could not read lessons');
select results_eq($$ select job from public.jobs_overdue() $$, array['check-videos'], 'a failed job is overdue');
select is((select last_error from public.job_runs where job = 'check-videos'), 'Could not read lessons', 'the error is kept');

-- A success later clears it.
select public.record_job('check-videos', true, null);
select is_empty($$ select * from public.jobs_overdue() $$, 'a later success clears the failure');

-- A success more than 26 hours ago is overdue.
update public.job_runs set ok_at = now() - interval '27 hours' where job = 'send-emails';
select results_eq($$ select job from public.jobs_overdue() $$, array['send-emails'], 'a job silent for over a day is overdue');

-- Pruning: rows older than 90 days go, sent or not; newer rows stay.
insert into public.email_outbox (to_email, template, created_at, sent_at) values
  ('old-sent@t.test', 'x', now() - interval '91 days', now() - interval '91 days'),
  ('old-unsent@t.test', 'x', now() - interval '91 days', null),
  ('new@t.test', 'x', now() - interval '89 days', now() - interval '89 days');
select is(public.prune_email_outbox(), 2, 'two old rows are pruned');
select is((select count(*)::int from public.email_outbox where to_email like '%@t.test'), 1, 'the newer row stays');

-- Nobody but the service role.
set local role authenticated;
select throws_ok($$ select public.record_job('send-emails', true, null) $$, '42501', null, 'a user cannot record a job');
select throws_ok($$ select public.prune_email_outbox() $$, '42501', null, 'a user cannot prune');
select throws_ok($$ select * from public.job_runs $$, '42501', null, 'a user cannot read job runs');

select * from finish();
rollback;
