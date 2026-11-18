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

-- What the invite page shows a guest: no rows for a code that never existed. A reset link, or one whose coach
-- deleted their account, is inactive and shows nothing about the program, so a leaked old link reveals no later edits.
create function public.invite_info(code text)
returns table (program_id uuid, title text, summary text, weeks smallint, category_id text, coach_name text, active boolean, published boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select case when a.active then p.id end, case when a.active then p.title end, case when a.active then p.summary end,
    case when a.active then p.weeks end, case when a.active then p.category_id end, case when a.active then coalesce(c.display_name, '') end,
    a.active, a.active and public.program_is_published(p.id)
  from public.invites i
  join public.programs p on p.id = i.program_id
  left join public.profiles c on c.id = p.coach_id
  cross join lateral (select i.revoked_at is null and p.coach_id is not null as active) a
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

-- The joined list for the owning coach: active members' names and dates only. Someone who left or was removed
-- drops off at once, and so does the list itself for an owner who lost the coach role.
create function public.program_members(program uuid)
returns table (enrollment_id uuid, athlete_id uuid, display_name text, joined_at timestamptz, status public.enrollment_status)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.owns_program(program) or not public.has_role('coach') then
    raise exception 'not_owner' using errcode = '42501';
  end if;
  return query
    select e.id, e.athlete_id, p.display_name, e.joined_at, e.status
    from public.enrollments e join public.profiles p on p.id = e.athlete_id
    where e.program_id = program and e.status = 'active' order by e.joined_at desc;
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
create policy enrollments_select_coach on public.enrollments for select to authenticated
  using (status = 'active' and public.owns_program(program_id) and public.has_role('coach'));

-- The download adds the programs joined (DPDP access request). Everything else is as in 20261113500000_saves.sql.
create or replace function public.export_my_data()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'sign in first' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'exported_at', now(),
    'email', (select email from auth.users where id = uid),
    'profile', (select to_jsonb(p) from public.profiles p where p.id = uid),
    'roles', coalesce((select jsonb_agg(r.role order by r.role) from public.user_roles r where r.user_id = uid), '[]'),
    'sports', coalesce((select jsonb_agg(jsonb_build_object('sport', a.category_id, 'answers', a.answers)) from public.athlete_prefs a where a.user_id = uid), '[]'),
    'training', (select to_jsonb(b) - 'user_id' from public.athlete_basics b where b.user_id = uid),
    'body_metrics', coalesce((select jsonb_agg(to_jsonb(m) - 'user_id' order by m.measured_at) from public.body_metrics m where m.user_id = uid), '[]'),
    'consents', coalesce((select jsonb_agg(to_jsonb(c) - 'user_id' order by c.created_at) from public.consents c where c.user_id = uid), '[]'),
    'coach_applications', coalesce((select jsonb_agg(to_jsonb(x) - 'user_id' - 'decided_by' order by x.created_at) from public.coach_applications x where x.user_id = uid), '[]'),
    'saved', coalesce((select jsonb_agg(jsonb_build_object('item', c.slug, 'at', s.created_at) order by s.created_at)
      from public.saves s join public.content_items c on c.id = s.item_id where s.user_id = uid), '[]'),
    'completed', coalesce((select jsonb_agg(jsonb_build_object('item', c.slug, 'at', s.created_at) order by s.created_at)
      from public.completions s join public.content_items c on c.id = s.item_id where s.user_id = uid), '[]'),
    'programs', coalesce((select jsonb_agg(jsonb_build_object('program', p.title, 'status', e.status, 'start_date', e.start_date,
        'joined_at', e.joined_at, 'ended_at', e.ended_at) order by e.joined_at)
      from public.enrollments e join public.programs p on p.id = e.program_id where e.athlete_id = uid), '[]'),
    'account_created_at', (select created_at from auth.users where id = uid),
    'last_sign_in_at', (select last_sign_in_at from auth.users where id = uid),
    'queued_emails', coalesce((select jsonb_agg(jsonb_build_object('to', o.to_email, 'template', o.template, 'data', o.data, 'created_at', o.created_at, 'sent_at', o.sent_at) order by o.id)
      from public.email_outbox o where o.user_id = uid or lower(o.to_email) = lower((select email from auth.users where id = uid))), '[]'),
    -- Role changes about the person, by action and time; the other party shows only as an id.
    'audit_events', coalesce((select jsonb_agg(jsonb_build_object('action', l.action, 'details', l.details, 'at', l.created_at) order by l.id)
      from public.audit_log l where l.target_id = uid), '[]')
  );
end;
$$;
