-- M3-04: leaving, removal, and the coach access rule (architecture 4.2, risk R2).
-- One function, coach_can_read, decides whether a coach may read an athlete's data. Every policy that opens an
-- athlete's rows to a coach calls it, so access ends for all of them the moment the enrollment ends.
-- M4 adds paid engagements to the same function. Logs (M3-07) and feedback (M3-13) will use it too; feedback stays
-- readable by the athlete through its own policy, whatever happens to the enrollment.

-- True while the athlete has an active enrollment in a program the caller owns, and the caller is a coach.
create function public.coach_can_read(athlete uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_role('coach') and exists (
    select 1 from public.enrollments e join public.programs p on p.id = e.program_id
    where e.athlete_id = athlete and e.status = 'active' and p.coach_id = auth.uid()
  );
$$;

-- The athlete ends their own enrollment. The coach's access ends with it.
create function public.leave_program(enrollment uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  e public.enrollments;
begin
  select * into e from public.enrollments where id = enrollment for update;
  if not found or e.athlete_id is distinct from auth.uid() then
    raise exception 'not_yours' using errcode = '42501';
  end if;
  if e.status <> 'active' then
    raise exception 'not_active' using errcode = '22023';
  end if;
  update public.enrollments set status = 'left', ended_at = now() where id = enrollment;
end;
$$;

-- The owning coach removes an athlete. join_program refuses them afterwards, through any link.
create function public.remove_athlete(enrollment uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  e public.enrollments;
begin
  select * into e from public.enrollments where id = enrollment for update;
  if not found or not public.owns_program(e.program_id) or not public.has_role('coach') then
    raise exception 'not_owner' using errcode = '42501';
  end if;
  if e.status <> 'active' then
    raise exception 'not_active' using errcode = '22023';
  end if;
  update public.enrollments set status = 'removed', ended_at = now() where id = enrollment;
end;
$$;

-- The caller's active programs with their coach's name, which athletes cannot read from profiles.
create function public.my_programs()
returns table (enrollment_id uuid, program_id uuid, title text, summary text, weeks smallint, category_id text, coach_name text, start_date date, joined_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select e.id, p.id, p.title, p.summary, p.weeks, p.category_id, coalesce(c.display_name, ''), e.start_date, e.joined_at
  from public.enrollments e
  join public.programs p on p.id = e.program_id
  left join public.profiles c on c.id = p.coach_id
  where e.athlete_id = auth.uid() and e.status = 'active'
  order by e.joined_at desc;
$$;

revoke execute on function public.coach_can_read(uuid), public.leave_program(uuid), public.remove_athlete(uuid), public.my_programs() from public, anon;
grant execute on function public.coach_can_read(uuid), public.leave_program(uuid), public.remove_athlete(uuid), public.my_programs() to authenticated;

-- A coach reads the sign-up answers of their current athletes: profile, sport answers, training basics.
-- Body metrics stay private until the progress pages (M3-11) decide how a coach sees them.
create policy profiles_select_coach on public.profiles for select to authenticated using (public.coach_can_read(id));
create policy athlete_prefs_select_coach on public.athlete_prefs for select to authenticated using (public.coach_can_read(user_id));
create policy athlete_basics_select_coach on public.athlete_basics for select to authenticated using (public.coach_can_read(user_id));
