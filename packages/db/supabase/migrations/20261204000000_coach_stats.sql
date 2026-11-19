-- M4-05: a live coach's public stats (P-Coach "On FitSphere"), from FitSphere records only: never typed by the coach.
-- shortcut: counts program enrollments only; M4-07 (engagements) redefines this to add paid coaching clients.
-- The two percentages stay hidden while fewer than 3 athletes count toward them, so no single client's
-- adherence or leaving date can be read off a public page.
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
    select en.*
    from public.enrollments en
    join public.programs p on p.id = en.program_id
    where p.coach_id = coach and en.athlete_id <> coach
  ),
  -- Per athlete: when they first joined, and the longest time they stayed in one of this coach's programs.
  a as (
    select e.athlete_id, min(e.joined_at) as first_joined, max(coalesce(e.ended_at, now()) - e.joined_at) as longest
    from e group by e.athlete_id
  ),
  -- Sessions scheduled for active enrollments up to today, as in public.adherence (20261124000000_metrics.sql).
  sched as (
    select e.athlete_id, s.id as session_id, d.on_date
    from e
    cross join lateral (
      select g::date as on_date from generate_series(e.start_date, least(public.india_today(), e.start_date + 26 * 7 - 1), interval '1 day') g
    ) d
    join public.program_versions v on v.id = public.version_in_effect(e.program_id, d.on_date)
    join public.program_sessions s on s.version_id = v.id and s.week <= v.weeks
      and e.start_date + (s.week - 1) * 7 + (s.day - 1) = d.on_date
    where e.status = 'active'
  ),
  adh as (
    select count(distinct sched.athlete_id)::int as people, count(*)::int as scheduled, count(l.id)::int as completed
    from sched
    left join public.session_logs l on l.athlete_id = sched.athlete_id and l.session_id = sched.session_id
      and l.on_date = sched.on_date and l.completed_at is not null
  ),
  stay as (
    select count(*)::int as people, count(*) filter (where a.longest >= interval '90 days')::int as stayed
    from a where a.first_joined <= now() - interval '90 days'
  )
  select
    (select count(*)::int from a),
    -- Finished: still enrolled after the last day of the version they started on.
    (select count(*)::int from e
      join public.program_versions v on v.id = public.version_in_effect(e.program_id, e.start_date)
      where e.status = 'active' and public.india_today() > e.start_date + v.weeks * 7 - 1),
    case when stay.people >= 3 then round(100.0 * stay.stayed / stay.people)::int end,
    case when adh.people >= 3 and adh.scheduled > 0 then round(100.0 * adh.completed / adh.scheduled)::int end
  from stay, adh;
end;
$$;

revoke all on function public.coach_stats(uuid) from public;
grant execute on function public.coach_stats(uuid) to anon, authenticated;

-- The portfolio's programs on a live coach's public profile: published ones, as frozen on their newest published
-- version, with how many athletes are enrolled now. Programs stay private otherwise (invite only, M3).
create function public.coach_programs(coach uuid)
returns table (program_id uuid, title text, weeks smallint, enrolled_now int)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, v.title, v.weeks,
    (select count(*)::int from public.enrollments e where e.program_id = p.id and e.status = 'active' and e.athlete_id <> coach)
  from public.programs p
  cross join lateral (
    select pv.title, pv.weeks from public.program_versions pv
    where pv.program_id = p.id and pv.published_at is not null order by pv.version desc limit 1
  ) v
  where p.coach_id = coach and public.coach_is_live(coach)
    -- Only programs 3 or more athletes have joined: a program made for one client could name them in its title.
    and (select count(distinct e.athlete_id) from public.enrollments e where e.program_id = p.id and e.athlete_id <> coach) >= 3
  order by v.title;
$$;

revoke all on function public.coach_programs(uuid) from public;
grant execute on function public.coach_programs(uuid) to anon, authenticated;
