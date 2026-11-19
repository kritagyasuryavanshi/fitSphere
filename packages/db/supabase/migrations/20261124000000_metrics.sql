-- M3-10: training metrics, with the rules in docs/plans/m3-metrics.md. Security invoker: each function reads the
-- logs through their RLS, so the athlete gets their own numbers, their coach gets the numbers for the coach's
-- programs (coach_can_read and owns_program), and anyone else gets none.

-- Sessions scheduled for the athlete's active enrollments from each start date up to today, today included, and how
-- many of them are finished. A program the athlete left drops out. The schedule follows the version in effect on
-- each date, as Today does, and stops at the version's last week.
create function public.adherence(athlete uuid, program uuid default null)
returns table (scheduled int, completed int)
language sql
stable
security invoker
set search_path = ''
as $$
  with sched as (
    select s.id as session_id, d.on_date
    from public.enrollments e
    cross join lateral (
      select g::date as on_date from generate_series(e.start_date, least(public.india_today(), e.start_date + 26 * 7 - 1), interval '1 day') g
    ) d
    join public.program_versions v on v.id = public.version_in_effect(e.program_id, d.on_date)
    join public.program_sessions s on s.version_id = v.id and s.week <= v.weeks
      and e.start_date + (s.week - 1) * 7 + (s.day - 1) = d.on_date
    where e.athlete_id = adherence.athlete and e.status = 'active'
      and (adherence.program is null or e.program_id = adherence.program)
  )
  select count(*)::int, count(l.id)::int
  from sched
  left join public.session_logs l on l.athlete_id = adherence.athlete and l.session_id = sched.session_id
    and l.on_date = sched.on_date and l.completed_at is not null;
$$;

-- Each exercise has at most one primary muscle, so a hard set counts once. Every writer so far marks only the first.
create unique index content_muscles_one_primary on public.content_muscles (item_id) where is_primary;

-- Hard sets (at least one rep at RPE 7 or more) from gym logs between two dates, counted once for the exercise's
-- primary muscle. S&C and boxing logs do not count, whatever the exercise. With a log, only that session's sets.
-- An exercise whose primary muscle the caller cannot see (not published) adds nothing.
create function public.hard_sets_per_muscle(athlete uuid, from_date date, to_date date, log uuid default null)
returns table (muscle_id text, name text, muscle_group text, sets int)
language sql
stable
security invoker
set search_path = ''
as $$
  select m.id, m.name, m.muscle_group, count(*)::int
  from public.session_logs l
  join public.item_logs i on i.log_id = l.id and i.type = 'sets'
  join public.set_logs x on x.item_log_id = i.id and x.reps >= 1 and x.rpe >= 7
  join public.content_muscles cm on cm.item_id = i.item_id and cm.is_primary
  join public.muscles m on m.id = cm.muscle_id
  where l.athlete_id = hard_sets_per_muscle.athlete and l.category_id = 'gym'
    and l.on_date between hard_sets_per_muscle.from_date and hard_sets_per_muscle.to_date
    and (hard_sets_per_muscle.log is null or l.id = hard_sets_per_muscle.log)
  group by m.id, m.name, m.muscle_group, m.sort
  order by m.sort;
$$;

-- Per drill, the mean technique feel of its last five logs, to one decimal. Newest by date, then by the session's
-- start, then by position: none of these change when a log is edited, so an edit cannot reorder the window.
create function public.skill_ratings(athlete uuid)
returns table (item_id uuid, rating numeric, logs int)
language sql
stable
security invoker
set search_path = ''
as $$
  select r.item_id, round(avg(r.technique), 1), count(*)::int
  from (
    select i.item_id, i.technique,
      row_number() over (partition by i.item_id order by l.on_date desc, l.started_at desc, i.position desc) as n
    from public.session_logs l
    join public.item_logs i on i.log_id = l.id
    where l.athlete_id = skill_ratings.athlete and i.technique is not null and i.item_id is not null
  ) r
  where r.n <= 5
  group by r.item_id;
$$;

revoke execute on function public.adherence(uuid, uuid), public.hard_sets_per_muscle(uuid, date, date, uuid), public.skill_ratings(uuid) from public, anon;
grant execute on function public.adherence(uuid, uuid), public.hard_sets_per_muscle(uuid, date, date, uuid), public.skill_ratings(uuid) to authenticated;
