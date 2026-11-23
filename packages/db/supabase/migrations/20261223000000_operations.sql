-- M6-12: daily job records for the failure alert, and email outbox pruning (the privacy notice promises 90 days).
-- Only the service role (the cron routes and the health check) can reach any of this.

create table public.job_runs (
  job text primary key check (job in ('send-emails', 'check-videos')),
  ok_at timestamptz,
  failed_at timestamptz,
  last_error text
);
alter table public.job_runs enable row level security;
revoke all on public.job_runs from anon, authenticated;
grant all on public.job_runs to service_role;
insert into public.job_runs (job) values ('send-emails'), ('check-videos');

-- How a job run ended. A failure keeps its error until a later success.
create function public.record_job(job_name text, ok boolean, error text)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.job_runs
     set ok_at = case when ok then now() else ok_at end,
         failed_at = case when ok then null else now() end,
         last_error = case when ok then null else left(error, 500) end
   where job = job_name;
$$;
revoke all on function public.record_job(text, boolean, text) from public, anon, authenticated;
grant execute on function public.record_job(text, boolean, text) to service_role;

-- Jobs to alert on: the last run failed, or no success for 26 hours (a daily job, with two hours' slack).
create function public.jobs_overdue()
returns table (job text, ok_at timestamptz, failed_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select r.job, r.ok_at, r.failed_at from public.job_runs r
   where r.failed_at is not null or r.ok_at is null or r.ok_at < now() - interval '26 hours'
   order by r.job;
$$;
revoke all on function public.jobs_overdue() from public, anon, authenticated;
grant execute on function public.jobs_overdue() to service_role;

-- Email rows older than 90 days go, sent or not: an unsent one stopped retrying after 7 days.
create function public.prune_email_outbox()
returns integer
language sql
security definer
set search_path = ''
as $$
  with gone as (delete from public.email_outbox where created_at < now() - interval '90 days' returning 1)
  select count(*)::int from gone;
$$;
revoke all on function public.prune_email_outbox() from public, anon, authenticated;
grant execute on function public.prune_email_outbox() to service_role;
