-- M1-01 identity: profiles, user_roles, consents, audit_log (architecture section 4).
-- Clients never write roles or audit rows. Only grant_role and revoke_role change roles, and a trigger audits every change.

create type public.app_role as enum ('athlete', 'coach', 'reviewer', 'admin');
create type public.consent_purpose as enum ('ai_health_personalisation');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '',
  date_of_birth date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger profiles_set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

create table public.user_roles (
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.app_role not null,
  granted_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (user_id, role)
);

-- Append-only: the newest row per user and purpose is the current answer.
create table public.consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  purpose public.consent_purpose not null,
  granted boolean not null,
  created_at timestamptz not null default now()
);
create index consents_user_purpose_idx on public.consents (user_id, purpose, created_at desc);

-- No foreign keys, so the log survives when a user is deleted.
create table public.audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid,
  action text not null,
  target_id uuid,
  details jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index audit_log_target_idx on public.audit_log (target_id, created_at desc);

-- Policies call this. Security definer, so it reads user_roles without recursing into its RLS.
create function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.user_roles where user_id = auth.uid() and role = 'admin');
$$;

create function public.grant_role(target uuid, new_role public.app_role)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'only an admin can grant a role' using errcode = '42501';
  end if;
  if target = auth.uid() then
    raise exception 'nobody can change their own roles' using errcode = '42501';
  end if;
  insert into public.user_roles (user_id, role, granted_by)
  values (target, new_role, auth.uid())
  on conflict do nothing;
end;
$$;

create function public.revoke_role(target uuid, old_role public.app_role)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'only an admin can revoke a role' using errcode = '42501';
  end if;
  if target = auth.uid() then
    raise exception 'nobody can change their own roles' using errcode = '42501';
  end if;
  delete from public.user_roles where user_id = target and role = old_role;
end;
$$;

-- Audits every role change, whatever the path (functions, seed, service role).
create function public.audit_role_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op in ('INSERT', 'UPDATE') then
    insert into public.audit_log (actor_id, action, target_id, details)
    values (auth.uid(), 'role_granted', new.user_id, jsonb_build_object('role', new.role));
  end if;
  if tg_op in ('DELETE', 'UPDATE') then
    insert into public.audit_log (actor_id, action, target_id, details)
    values (auth.uid(), 'role_revoked', old.user_id, jsonb_build_object('role', old.role));
  end if;
  return null;
end;
$$;
create trigger user_roles_audit after insert or update or delete on public.user_roles
  for each row execute function public.audit_role_change();

-- Every new auth user gets a profile and the athlete role.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', ''));
  insert into public.user_roles (user_id, role) values (new.id, 'athlete');
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Privileges. Supabase grants everything to anon and authenticated by default, so start from nothing.
revoke all on public.profiles, public.user_roles, public.consents, public.audit_log from anon, authenticated;
grant select on public.profiles, public.user_roles, public.consents, public.audit_log to authenticated;
grant update (display_name, date_of_birth) on public.profiles to authenticated;
grant insert (user_id, purpose, granted) on public.consents to authenticated;

revoke execute on function public.is_admin(), public.grant_role(uuid, public.app_role), public.revoke_role(uuid, public.app_role),
  public.audit_role_change(), public.handle_new_user() from public, anon, authenticated;
grant execute on function public.is_admin(), public.grant_role(uuid, public.app_role), public.revoke_role(uuid, public.app_role) to authenticated;

-- Row level security.
alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.consents enable row level security;
alter table public.audit_log enable row level security;

create policy profiles_select_own on public.profiles for select to authenticated using (id = (select auth.uid()));
create policy profiles_select_admin on public.profiles for select to authenticated using ((select public.is_admin()));
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy user_roles_select_own on public.user_roles for select to authenticated using (user_id = (select auth.uid()));
create policy user_roles_select_admin on public.user_roles for select to authenticated using ((select public.is_admin()));

create policy consents_select_own on public.consents for select to authenticated using (user_id = (select auth.uid()));
create policy consents_insert_own on public.consents for insert to authenticated with check (user_id = (select auth.uid()));

create policy audit_log_select_admin on public.audit_log for select to authenticated using ((select public.is_admin()));
