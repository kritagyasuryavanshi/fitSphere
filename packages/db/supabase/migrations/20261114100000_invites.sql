-- M3-03: one invite link per program, reset on demand, and joining through it.
-- Joining creates an enrollment; M3-04 adds leaving, removal and the coach access rule.

create type public.enrollment_status as enum ('active', 'left', 'removed');

create table public.invites (
  code text primary key check (code ~ '^[0-9a-f]{32}$'),
  program_id uuid not null references public.programs (id) on delete cascade,
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);
create unique index invites_one_active on public.invites (program_id) where revoked_at is null;

create table public.enrollments (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.programs (id) on delete cascade,
  athlete_id uuid not null references public.profiles (id) on delete cascade,
  invite_code text references public.invites (code) on delete set null,
  status public.enrollment_status not null default 'active',
  -- The India date of joining is week 1 day 1 (packages/core schedule.ts).
  start_date date not null,
  joined_at timestamptz not null default now(),
  ended_at timestamptz
);
create unique index enrollments_one_active on public.enrollments (program_id, athlete_id) where status = 'active';
create index enrollments_athlete_idx on public.enrollments (athlete_id, status);
create index enrollments_invite_idx on public.enrollments (invite_code);

-- 122 random bits from gen_random_uuid, as 32 hex characters.
create function public.new_invite_code()
returns text
language sql
volatile
set search_path = ''
as $$
  select replace(gen_random_uuid()::text, '-', '');
$$;

-- The active code of a program the caller owns, made on first use.
create function public.program_invite(program uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  c text;
begin
  perform public.own_draft(program);
  select code into c from public.invites where program_id = program and revoked_at is null;
  if c is null then
    insert into public.invites (code, program_id) values (public.new_invite_code(), program) returning code into c;
  end if;
  return c;
end;
$$;

-- The old link stops working at once; people who joined stay in.
create function public.reset_invite(program uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.own_draft(program);
  update public.invites set revoked_at = now() where program_id = program and revoked_at is null;
  return public.program_invite(program);
end;
$$;

-- What the invite page shows a guest: no rows for a code that never existed.
create function public.invite_info(code text)
returns table (program_id uuid, title text, summary text, weeks smallint, category_id text, coach_name text, active boolean, published boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.title, p.summary, p.weeks, p.category_id, coalesce(c.display_name, ''), i.revoked_at is null,
    exists (select 1 from public.program_versions v where v.program_id = p.id and v.published_at is not null)
  from public.invites i
  join public.programs p on p.id = i.program_id
  left join public.profiles c on c.id = p.coach_id
  where i.code = invite_info.code;
$$;

create function public.join_program(code text)
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
  select * into inv from public.invites i where i.code = join_program.code;
  if not found or inv.revoked_at is not null then
    raise exception 'invite_inactive' using errcode = '22023';
  end if;
  if not public.program_is_published(inv.program_id) then
    raise exception 'not_published' using errcode = '22023';
  end if;
  if exists (select 1 from public.programs where id = inv.program_id and coach_id = uid) then
    raise exception 'own_program' using errcode = '22023';
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

-- The joined list for the owning coach: names and dates only.
create function public.program_members(program uuid)
returns table (enrollment_id uuid, athlete_id uuid, display_name text, joined_at timestamptz, status public.enrollment_status)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.owns_program(program) then
    raise exception 'not_owner' using errcode = '42501';
  end if;
  return query
    select e.id, e.athlete_id, p.display_name, e.joined_at, e.status
    from public.enrollments e join public.profiles p on p.id = e.athlete_id
    where e.program_id = program order by e.joined_at desc;
end;
$$;

revoke all on public.invites, public.enrollments from anon, authenticated;
grant all on public.invites, public.enrollments to service_role;
grant select on public.enrollments to authenticated;
revoke execute on function public.new_invite_code(), public.program_invite(uuid), public.reset_invite(uuid), public.invite_info(text),
  public.join_program(text), public.program_members(uuid) from public, anon, authenticated;
grant execute on function public.program_invite(uuid), public.reset_invite(uuid), public.join_program(text), public.program_members(uuid) to authenticated;
grant execute on function public.invite_info(text) to anon, authenticated;
-- join_program raises "sign in first" (42501) for a guest through require_step1.
grant execute on function public.join_program(text) to anon;

alter table public.invites enable row level security;
alter table public.enrollments enable row level security;
-- Invites are read only through the functions above. Athletes see their own enrollments; the coach sees those of their programs.
create policy enrollments_select_own on public.enrollments for select to authenticated using (athlete_id = (select auth.uid()));
create policy enrollments_select_coach on public.enrollments for select to authenticated using (public.owns_program(program_id));
