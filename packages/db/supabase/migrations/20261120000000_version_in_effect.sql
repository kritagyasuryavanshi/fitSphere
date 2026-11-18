-- M3-06: athletes see the version in effect, never the coach's draft (from the PR #27 review).
-- save_program_draft writes title, summary and weeks on programs, so those are the draft's. Publishing now freezes
-- them on the version, and everything an athlete or guest reads comes from a published version.

alter table public.program_versions
  add column title text check (char_length(btrim(title)) between 1 and 120),
  add column summary text check (char_length(summary) <= 500),
  add column weeks smallint check (weeks between 1 and 26);

-- Versions published before this migration take the program's current values. For a program whose draft was
-- edited after publishing these are the draft's values, not the published ones, and the old values are not kept
-- anywhere. Acceptable here: no production database exists yet (O-02), only local and test data.
update public.program_versions v set title = p.title, summary = p.summary, weeks = p.weeks
from public.programs p where p.id = v.program_id and v.published_at is not null;

alter table public.program_versions add constraint program_versions_frozen check ((published_at is null) or (title is not null and weeks is not null and summary is not null));

-- The published version that applies on a date: the newest whose first day has come. Before any has (a join on
-- the evening a first version goes live cannot happen, since the first is live the same day), the earliest.
create function public.version_in_effect(program uuid, on_date date)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select id from public.program_versions where program_id = program and published_at is not null and effective_from <= on_date
      order by effective_from desc, version desc limit 1),
    (select id from public.program_versions where program_id = program and published_at is not null order by version limit 1)
  );
$$;

-- publish_program as in 20261114000000_programs.sql, plus freezing title, summary and weeks on the version.
create or replace function public.publish_program(program uuid)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  draft uuid := public.own_draft(program);
  v int;
  next_draft uuid;
  s record;
  copy uuid;
  p public.programs;
begin
  if not exists (select 1 from public.program_sessions where version_id = draft) then
    raise exception 'empty_program' using errcode = '22023';
  end if;
  select * into p from public.programs where id = program;
  if btrim(p.title) = '' then
    raise exception 'title_required' using errcode = '22023';
  end if;
  update public.program_versions set published_at = now(), title = p.title, summary = p.summary, weeks = p.weeks,
    effective_from = case when exists (select 1 from public.program_versions where program_id = program and published_at is not null)
                          then public.india_today() + 1 else public.india_today() end
  where id = draft returning version into v;

  insert into public.program_versions (program_id, version) values (program, v + 1) returning id into next_draft;
  for s in select * from public.program_sessions where version_id = draft order by position loop
    insert into public.program_sessions (version_id, week, day, position, title) values (next_draft, s.week, s.day, s.position, s.title) returning id into copy;
    insert into public.session_items (session_id, position, item_id, type, prescription, cue)
      select copy, position, item_id, type, prescription, cue from public.session_items where session_id = s.id;
  end loop;
  return v;
end;
$$;

-- invite_info as in 20261114100000_invites.sql, reading the version someone joining today would follow.
-- An unpublished program shows its working title on the "not open yet" page, to people the coach gave the link.
create or replace function public.invite_info(code text)
returns table (program_id uuid, title text, summary text, weeks smallint, category_id text, coach_name text, active boolean, published boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select case when a.active then p.id end, case when a.active then coalesce(v.title, p.title) end, case when a.active then coalesce(v.summary, p.summary) end,
    case when a.active then coalesce(v.weeks, p.weeks) end, case when a.active then p.category_id end, case when a.active then coalesce(c.display_name, '') end,
    a.active, a.active and v.id is not null
  from public.invites i
  join public.programs p on p.id = i.program_id
  left join public.profiles c on c.id = p.coach_id
  left join public.program_versions v on v.id = public.version_in_effect(p.id, public.india_today())
  cross join lateral (select i.revoked_at is null and p.coach_id is not null as active) a
  where i.code = invite_info.code;
$$;

-- my_programs, now with the version in effect today, its title, summary and length.
drop function public.my_programs();
create function public.my_programs()
returns table (enrollment_id uuid, program_id uuid, version_id uuid, title text, summary text, weeks smallint, category_id text, coach_name text, start_date date, joined_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select e.id, p.id, v.id, v.title, v.summary, v.weeks, p.category_id, coalesce(c.display_name, ''), e.start_date, e.joined_at
  from public.enrollments e
  join public.programs p on p.id = e.program_id
  join public.program_versions v on v.id = public.version_in_effect(p.id, public.india_today())
  left join public.profiles c on c.id = p.coach_id
  where e.athlete_id = auth.uid() and e.status = 'active'
  order by e.joined_at desc;
$$;

revoke execute on function public.version_in_effect(uuid, date), public.my_programs() from public, anon;
grant execute on function public.version_in_effect(uuid, date), public.my_programs() to authenticated;

-- programs now holds only the coach's working values, so only its coach reads it. Everyone else reads published
-- versions (their own RLS) or the functions above. The other program policies do not depend on this one.
drop policy programs_select_published on public.programs;
