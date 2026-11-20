-- M4-05b: a coach chooses which published programs show on their public profile. Programs stay private (invite only,
-- M3) unless listed: a program made for one client can name them in its title, so nothing shows by default.

alter table public.programs add column show_on_profile boolean not null default false;

-- Lists or unlists the caller's own published program.
create function public.set_program_listed(program uuid, listed boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'sign in first' using errcode = '42501';
  end if;
  if listed is null then
    raise exception 'bad_input' using errcode = '22023';
  end if;
  if not public.has_role('coach') or not exists (select 1 from public.programs p where p.id = program and p.coach_id = uid) then
    raise exception 'not_owner' using errcode = '42501';
  end if;
  if listed and not exists (select 1 from public.program_versions v where v.program_id = program and v.published_at is not null) then
    raise exception 'not_published' using errcode = '22023';
  end if;
  update public.programs set show_on_profile = listed where id = program;
end;
$$;
revoke all on function public.set_program_listed(uuid, boolean) from public;
grant execute on function public.set_program_listed(uuid, boolean) to authenticated;

-- A live coach's listed programs, as frozen on their newest published version. The enrolled count shows from 5
-- athletes, the floor the profile stats use, so it cannot single anyone out.
create function public.coach_programs(coach uuid)
returns table (program_id uuid, title text, weeks smallint, enrolled_now int)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, v.title, v.weeks, case when n.c >= 5 then n.c end
  from public.programs p
  cross join lateral (
    select pv.title, pv.weeks from public.program_versions pv
    where pv.program_id = p.id and pv.published_at is not null order by pv.version desc limit 1
  ) v
  cross join lateral (
    select count(*)::int as c from public.enrollments e where e.program_id = p.id and e.status = 'active' and e.athlete_id <> coach
  ) n
  where p.coach_id = coach and p.show_on_profile and public.coach_is_live(coach)
  order by v.title;
$$;
revoke all on function public.coach_programs(uuid) from public;
grant execute on function public.coach_programs(uuid) to anon, authenticated;
