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

-- join_program as in 20261114100000_invites.sql, plus the athlete role: Today and the programs list are for
-- athletes, so an admin or reviewer account would hold a membership it could never use.
create or replace function public.join_program(code text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := public.require_step1();
  inv public.invites;
  e uuid;
begin
  -- FOR SHARE: a reset that commits first makes this join wait, then see the revoked code.
  select * into inv from public.invites i where i.code = join_program.code for share;
  if not found or inv.revoked_at is not null
    or not exists (select 1 from public.programs where id = inv.program_id and coach_id is not null) then
    raise exception 'invite_inactive' using errcode = '22023';
  end if;
  if not public.program_is_published(inv.program_id) then
    raise exception 'not_published' using errcode = '22023';
  end if;
  -- Sign-up is finished after step 2, the same rule as readAccount in apps/web/src/lib/viewer.ts.
  if not exists (select 1 from public.athlete_basics where user_id = uid) then
    raise exception 'signup_unfinished' using errcode = '22023';
  end if;
  if not public.has_role('athlete') then
    raise exception 'not_athlete' using errcode = '42501';
  end if;
  if exists (select 1 from public.programs where id = inv.program_id and coach_id = uid) then
    raise exception 'own_program' using errcode = '22023';
  end if;
  -- A coach's removal holds: the same or a new link does not let the athlete back in.
  if exists (select 1 from public.enrollments where program_id = inv.program_id and athlete_id = uid and status = 'removed') then
    raise exception 'removed_from_program' using errcode = '22023';
  end if;
  select id into e from public.enrollments where program_id = inv.program_id and athlete_id = uid and status = 'active';
  if e is null then
    insert into public.enrollments (program_id, athlete_id, invite_code, start_date)
    values (inv.program_id, uid, inv.code, public.india_today())
    on conflict do nothing returning id into e;
    -- A join running at the same moment won; return its row.
    if e is null then
      select id into e from public.enrollments where program_id = inv.program_id and athlete_id = uid and status = 'active';
    end if;
  end if;
  return e;
end;
$$;

revoke execute on function public.coach_can_read(uuid), public.leave_program(uuid), public.remove_athlete(uuid), public.my_programs() from public, anon;
grant execute on function public.coach_can_read(uuid), public.leave_program(uuid), public.remove_athlete(uuid), public.my_programs() to authenticated;

-- A coach reads the sign-up answers of their current athletes: profile, sport answers, training basics.
-- Body metrics stay private until the progress pages (M3-11) decide how a coach sees them.
create policy profiles_select_coach on public.profiles for select to authenticated using (public.coach_can_read(id));
create policy athlete_prefs_select_coach on public.athlete_prefs for select to authenticated using (public.coach_can_read(user_id));
create policy athlete_basics_select_coach on public.athlete_basics for select to authenticated using (public.coach_can_read(user_id));
