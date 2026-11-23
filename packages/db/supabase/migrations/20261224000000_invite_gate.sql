-- M6-15: invite-only admission for the step 1 beta (docs/plans/remaining-tasks-plan.md). Sign-up step 1 is the one
-- step every account passes, email or Google, so the gate sits there, beside the 18+ check and before any write.
-- No check before the magic link is sent: that would show which addresses are invited.

alter table public.app_settings add column signups_open boolean not null default false;

create table public.beta_invites (
  email text primary key check (email = lower(btrim(email)) and email like '%_@_%'),
  invited_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.beta_invites enable row level security;
revoke all on public.beta_invites from anon, authenticated;
grant all on public.beta_invites to service_role;

-- Admins invite an address. Inviting twice is harmless; each new invite is audited.
create function public.admin_invite(address text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  clean text := lower(btrim(address));
begin
  if not public.is_admin() then
    raise exception 'admins only' using errcode = '42501';
  end if;
  if clean is null or clean !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or length(clean) > 254 then
    raise exception 'bad_email' using errcode = '22023';
  end if;
  insert into public.beta_invites (email, invited_by) values (clean, auth.uid()) on conflict (email) do nothing;
  if found then
    insert into public.audit_log (actor_id, action, details) values (auth.uid(), 'beta_invite', jsonb_build_object('email', clean));
  end if;
end;
$$;
revoke all on function public.admin_invite(text) from public, anon;
grant execute on function public.admin_invite(text) to authenticated;

-- complete_about_you as in 20261220000000_age_gate.sql, plus the invite gate.
create or replace function public.complete_about_you(first_name text, birth_date date, sports text[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  name text := btrim(first_name);
  saved_dob date;
begin
  if uid is null then
    raise exception 'sign in first' using errcode = '42501';
  end if;
  if birth_date is null then
    raise exception 'dob_required' using errcode = '22023';
  end if;
  if birth_date > (now() at time zone 'Asia/Kolkata')::date then
    raise exception 'dob_in_future' using errcode = '22023';
  end if;
  -- The beta is 18+. A refused under-18 keeps nothing, because this runs before any write.
  if birth_date > ((now() at time zone 'Asia/Kolkata')::date - interval '18 years')::date then
    raise exception 'under_18' using errcode = '22023';
  end if;

  select date_of_birth into saved_dob from public.profiles where id = uid for update;
  if not found then
    raise exception 'no_profile' using errcode = '42501';
  end if;
  -- The invite gate (M6-15). Someone who already passed step 1 is never locked out by it.
  if saved_dob is null
     and not coalesce((select signups_open from public.app_settings), false)
     and not exists (select 1 from public.beta_invites b join auth.users u on b.email = lower(u.email) where u.id = uid) then
    raise exception 'not_invited' using errcode = '42501';
  end if;
  -- "We ask this once": the first date stands.
  if saved_dob is not null and saved_dob <> birth_date then
    raise exception 'dob_locked' using errcode = '22023';
  end if;

  if name = '' or name is null then
    raise exception 'name_required' using errcode = '22023';
  end if;
  if coalesce(cardinality(sports), 0) = 0 then
    raise exception 'sport_required' using errcode = '22023';
  end if;
  if exists (select 1 from unnest(sports) s where s is null or s not in (select id from public.categories where is_live)) then
    raise exception 'unknown_sport' using errcode = '22023';
  end if;

  update public.profiles set display_name = left(name, 80), date_of_birth = birth_date where id = uid;
  -- Keep the rows (and their answers) of sports still chosen; add new ones; drop the rest.
  delete from public.athlete_prefs where user_id = uid and category_id <> all (sports);
  insert into public.athlete_prefs (user_id, category_id) select distinct uid, s from unnest(sports) s
  on conflict (user_id, category_id) do nothing;
end;
$$;
