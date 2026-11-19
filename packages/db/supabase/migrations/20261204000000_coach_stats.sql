-- M4-05: a live coach's public stats (P-Coach "On FitSphere"), from FitSphere records only: never typed by the coach.
-- shortcut: counts program enrollments only; M4-07 (engagements) redefines this to add paid coaching clients.
-- Privacy: the two percentages stay hidden while fewer than 5 athletes count toward them, and show to the nearest 10%,
-- so a public page cannot be read back to one client's adherence or leaving date.
create function public.coach_stats(coach uuid)
returns table (athletes int, programs_finished int, stayed_pct int, adherence_pct int)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if coach is null then
    raise exception 'coach_needed' using errcode = '22023';
  end if;
  if not public.coach_is_live(coach) then
    return;
  end if;
  return query
  with e as (
    select en.id, en.program_id, en.athlete_id, en.status, en.start_date, en.joined_at, en.ended_at,
      -- The last day of the version the athlete started on, and the India date they left (or none).
      en.start_date + v0.weeks * 7 - 1 as last_day,
      (en.ended_at at time zone 'Asia/Kolkata')::date as left_on
    from public.enrollments en
    join public.programs p on p.id = en.program_id
    join public.program_versions v0 on v0.id = public.version_in_effect(en.program_id, en.start_date)
    where p.coach_id = coach and en.athlete_id <> coach
  ),
  -- Per athlete: how long they have been with this coach, from the first join to the last day in any program.
  a as (
    select e.athlete_id, min(e.joined_at) as first_joined, max(coalesce(e.ended_at, now())) - min(e.joined_at) as span
    from e group by e.athlete_id
  ),
  -- Sessions scheduled per enrollment up to today, while it lasted, as in public.adherence (20261124000000_metrics.sql).
  -- The days stop at the program's end, so a short program costs a few lookups, not 26 weeks of them.
  sched as (
    select e.id as enrollment_id, e.athlete_id, e.status, s.id as session_id, d.on_date
    from e
    cross join lateral (
      select g::date as on_date
      from generate_series(e.start_date, least(public.india_today(), coalesce(e.left_on, public.india_today()), e.start_date + 26 * 7 - 1,
        e.start_date + (select max(pv.weeks) from public.program_versions pv where pv.program_id = e.program_id and pv.published_at is not null) * 7 - 1),
        interval '1 day') g
    ) d
    join public.program_versions v on v.id = public.version_in_effect(e.program_id, d.on_date)
    join public.program_sessions s on s.version_id = v.id and s.week <= v.weeks
      and e.start_date + (s.week - 1) * 7 + (s.day - 1) = d.on_date
  ),
  per as (
    select sched.enrollment_id, sched.athlete_id, sched.status, count(*)::int as scheduled, count(l.id)::int as completed
    from sched
    left join public.session_logs l on l.athlete_id = sched.athlete_id and l.session_id = sched.session_id
      and l.on_date = sched.on_date and l.completed_at is not null
    group by sched.enrollment_id, sched.athlete_id, sched.status
  ),
  adh as (
    select count(distinct per.athlete_id)::int as people, coalesce(sum(per.scheduled), 0)::int as scheduled, coalesce(sum(per.completed), 0)::int as completed
    from per where per.status = 'active'
  ),
  stay as (
    select count(*)::int as people, count(*) filter (where a.span >= interval '90 days')::int as stayed
    from a where a.first_joined <= now() - interval '90 days'
  )
  select
    (select count(*)::int from a),
    -- Finished: the enrollment lasted past its last day, and at least half its sessions were done. Leaving later keeps it.
    (select count(*)::int from e join per on per.enrollment_id = e.id
      where public.india_today() > e.last_day and (e.left_on is null or e.left_on > e.last_day)
        and per.scheduled > 0 and per.completed * 2 >= per.scheduled),
    case when stay.people >= 5 then (round(10.0 * stay.stayed / stay.people) * 10)::int end,
    case when adh.people >= 5 and adh.scheduled > 0 then (round(10.0 * adh.completed / adh.scheduled) * 10)::int end
  from stay, adh;
end;
$$;

revoke all on function public.coach_stats(uuid) from public;
grant execute on function public.coach_stats(uuid) to anon, authenticated;
