-- M4-10: paid coaching opens coach access (architecture 4.2, risk R2).
-- An active or cancelling engagement gives the coach the same access as an enrollment, but only when the athlete chose
-- to share (engagements.share_data, asked on the hire form). The coach assigns one of their published programs to a
-- paying client; that enrollment carries the engagement, follows its sharing choice, and ends with the coaching.

alter table public.enrollments add column engagement_id uuid references public.engagements (id);
create index enrollments_engagement_idx on public.enrollments (engagement_id) where engagement_id is not null;

-- coach_can_read as in 20261119000000_enrollment_access.sql, plus paid coaching. An enrollment tied to an engagement
-- opens only while that engagement is paid and shared.
create or replace function public.coach_can_read(athlete uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_role('coach') and (
    exists (
      select 1 from public.enrollments e join public.programs p on p.id = e.program_id
      where e.athlete_id = athlete and e.status = 'active' and p.coach_id = auth.uid()
        and (e.engagement_id is null or exists (
          select 1 from public.engagements g where g.id = e.engagement_id and g.status in ('active', 'cancelling') and g.share_data))
    )
    or exists (
      select 1 from public.engagements g
      where g.athlete_id = athlete and g.coach_id = auth.uid() and g.status in ('active', 'cancelling') and g.share_data
    )
  );
$$;

-- coach_reads_program as in 20261125000000_m3_review_fixes.sql, with the same sharing rule for assigned programs.
create or replace function public.coach_reads_program(athlete uuid, program uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_role('coach') and exists (
    select 1 from public.enrollments e join public.programs p on p.id = e.program_id
    where e.athlete_id = athlete and e.program_id = program and e.status = 'active' and p.coach_id = auth.uid()
      and (e.engagement_id is null or exists (
        select 1 from public.engagements g where g.id = e.engagement_id and g.status in ('active', 'cancelling') and g.share_data))
  );
$$;

-- The coach assigns one of their published programs to a paying client, from the India date today. Assigning a
-- program the client is already in returns that enrollment.
create function public.assign_program(engagement uuid, program uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  g public.engagements;
  e uuid;
begin
  select * into g from public.engagements where id = engagement for update;
  if not found or g.coach_id is distinct from auth.uid() or not public.has_role('coach') then
    raise exception 'not_yours' using errcode = '42501';
  end if;
  if g.status not in ('active', 'cancelling') or g.athlete_id is null then
    raise exception 'not_active' using errcode = '22023';
  end if;
  if not public.owns_program(program) then
    raise exception 'not_owner' using errcode = '42501';
  end if;
  if not public.program_is_published(program) then
    raise exception 'not_published' using errcode = '22023';
  end if;
  select id into e from public.enrollments where program_id = program and athlete_id = g.athlete_id and status = 'active';
  if e is null then
    insert into public.enrollments (program_id, athlete_id, start_date, engagement_id)
    values (program, g.athlete_id, public.india_today(), g.id)
    returning id into e;
  end if;
  return e;
end;
$$;
revoke all on function public.assign_program(uuid, uuid) from public;
grant execute on function public.assign_program(uuid, uuid) to authenticated;

-- When the coaching stops (ended, lapsed or refunded), the programs assigned through it end too.
create function public.end_assigned_programs()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.enrollments set status = 'ended', ended_at = now() where engagement_id = new.id and status = 'active';
  return null;
end;
$$;
revoke all on function public.end_assigned_programs() from public, anon, authenticated;
create trigger engagements_end_assigned_programs after update of status on public.engagements for each row
  when (old.status in ('active', 'cancelling') and new.status not in ('active', 'cancelling'))
  execute function public.end_assigned_programs();

-- coach_stats as in 20261204000000_coach_stats.sql, plus paid coaching clients in the athlete count and the
-- stayed-90-days share. Adherence still comes from program enrollments, assigned ones included.
create or replace function public.coach_stats(coach uuid)
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
      -- A program assigned through coaching that was refunded does not count, as the coaching itself does not.
      and not exists (select 1 from public.engagements r where r.id = en.engagement_id and r.status = 'refunded')
  ),
  -- Paid coaching clients: every engagement paid for at least once and not refunded.
  paid as (
    select g.athlete_id, g.created_at as joined_at, g.ended_at
    from public.engagements g
    where g.coach_id = coach and g.athlete_id is not null and g.paid_through is not null and g.status <> 'refunded'
  ),
  -- Per athlete: how long they have been with this coach, from the first join or paid request to the last day.
  a as (
    select x.athlete_id, min(x.joined_at) as first_joined, max(coalesce(x.ended_at, now())) - min(x.joined_at) as span
    from (select e.athlete_id, e.joined_at, e.ended_at from e union all select paid.athlete_id, paid.joined_at, paid.ended_at from paid) x
    group by x.athlete_id
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

