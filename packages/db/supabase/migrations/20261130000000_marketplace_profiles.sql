-- M4-01: the marketplace's coach side (docs/plans/m4-plan.md section 1): profiles, packages, weekly slots and
-- credentials, with a private bucket for credential files. Clients never write these tables: every write goes through
-- a function that acts on the caller's own rows. The public reads live coaches, their live packages and their slots;
-- a credential shows only its title and status, and only once an admin checked it (M4-03 adds the check).

create table public.coach_profiles (
  coach_id uuid primary key references public.profiles (id) on delete cascade,
  headline text not null default '' check (char_length(headline) <= 120),
  philosophy text not null default '' check (char_length(philosophy) <= 2000),
  specialties text[] not null default '{}' check (cardinality(specialties) <= 10),
  languages text[] not null default '{}' check (cardinality(languages) <= 10),
  formats text[] not null default '{}' check (formats <@ array['online', 'in_person']),
  city text not null default '' check (char_length(city) <= 80),
  years smallint not null default 0 check (years between 0 and 60),
  -- How many paying clients the coach takes at once (owner default 10, the coach can change it).
  client_limit smallint not null default 10 check (client_limit between 1 and 100),
  agreement_version text,
  agreement_accepted_at timestamptz,
  -- The Razorpay Route linked account an admin pastes in (M4-13); null means manual payouts.
  payout_account_id text check (char_length(payout_account_id) <= 64),
  status text not null default 'draft' check (status in ('draft', 'live', 'suspended')),
  updated_at timestamptz not null default now()
);

create table public.packages (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.coach_profiles (coach_id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 80),
  kind text not null check (kind in ('monthly', 'single')),
  -- Paise, so money is always a whole number (₹4,500 is 450000).
  price_paise bigint not null check (price_paise between 1 and 100000000),
  currency text not null default 'INR' check (currency = 'INR'),
  live boolean not null default false,
  created_at timestamptz not null default now()
);
create index packages_coach_idx on public.packages (coach_id);

create table public.availability_slots (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.coach_profiles (coach_id) on delete cascade,
  -- 1 is Monday, 7 is Sunday; times are India time.
  dow smallint not null check (dow between 1 and 7),
  start_time time not null,
  minutes smallint not null check (minutes between 15 and 240)
);
create index availability_slots_coach_idx on public.availability_slots (coach_id);

create table public.credentials (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.coach_profiles (coach_id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 120),
  -- In the private bucket 'credentials', always under the coach's own folder.
  file_path text not null check (char_length(file_path) <= 300),
  status text not null default 'pending' check (status in ('pending', 'checked', 'rejected')),
  note text not null default '' check (char_length(note) <= 500),
  decided_by uuid references public.profiles (id) on delete set null,
  decided_at timestamptz,
  created_at timestamptz not null default now()
);
create index credentials_coach_idx on public.credentials (coach_id);

alter table public.coach_profiles enable row level security;
alter table public.packages enable row level security;
alter table public.availability_slots enable row level security;
alter table public.credentials enable row level security;

-- A live coach is public; the coach always sees their own; admins see all.
create function public.coach_is_live(coach uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.coach_profiles where coach_id = coach and status = 'live');
$$;

-- Separate policies for guests: is_admin is not executable by anon, as on content_items.
create policy coach_profiles_select_public on public.coach_profiles for select to anon using (status = 'live');
create policy coach_profiles_select on public.coach_profiles for select to authenticated
  using (status = 'live' or coach_id = (select auth.uid()) or (select public.is_admin()));
create policy packages_select_public on public.packages for select to anon using (live and public.coach_is_live(coach_id));
create policy packages_select on public.packages for select to authenticated
  using ((live and public.coach_is_live(coach_id)) or coach_id = (select auth.uid()) or (select public.is_admin()));
create policy availability_slots_select_public on public.availability_slots for select to anon using (public.coach_is_live(coach_id));
create policy availability_slots_select on public.availability_slots for select to authenticated
  using (public.coach_is_live(coach_id) or coach_id = (select auth.uid()) or (select public.is_admin()));
-- The full credential (file path, note) only for the coach and admins.
create policy credentials_select on public.credentials for select to authenticated
  using (coach_id = (select auth.uid()) or (select public.is_admin()));

revoke all on public.coach_profiles, public.packages, public.availability_slots, public.credentials from anon, authenticated;
grant select on public.coach_profiles, public.packages, public.availability_slots to anon, authenticated;
grant select on public.credentials to authenticated;

-- What the public sees of a credential: its title, once checked, for a live coach. No file path, no note.
create view public.public_credentials with (security_invoker = false) as
  select c.id, c.coach_id, c.title, c.decided_at
  from public.credentials c
  where c.status = 'checked' and public.coach_is_live(c.coach_id);
revoke all on public.public_credentials from anon, authenticated;
grant select on public.public_credentials to anon, authenticated;

-- The caller's coach profile, created on the first save. Only coaches have one.
create function public.save_coach_profile(headline text, philosophy text, specialties text[], languages text[], formats text[], city text, years int, client_limit int)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null or not public.has_role('coach') then
    raise exception 'not_coach' using errcode = '42501';
  end if;
  if char_length(btrim(coalesce(headline, ''))) > 120 or char_length(coalesce(philosophy, '')) > 2000
    or cardinality(coalesce(specialties, '{}')) > 10 or cardinality(coalesce(languages, '{}')) > 10
    or not coalesce(formats, '{}') <@ array['online', 'in_person']
    or char_length(btrim(coalesce(city, ''))) > 80 or years is null or years not between 0 and 60
    or client_limit is null or client_limit not between 1 and 100 then
    raise exception 'bad_profile' using errcode = '22023';
  end if;
  insert into public.coach_profiles (coach_id, headline, philosophy, specialties, languages, formats, city, years, client_limit)
  values (uid, btrim(coalesce(headline, '')), btrim(coalesce(philosophy, '')), coalesce(specialties, '{}'), coalesce(languages, '{}'),
    coalesce(formats, '{}'), btrim(coalesce(city, '')), years, client_limit)
  on conflict (coach_id) do update set headline = excluded.headline, philosophy = excluded.philosophy, specialties = excluded.specialties,
    languages = excluded.languages, formats = excluded.formats, city = excluded.city, years = excluded.years,
    client_limit = excluded.client_limit, updated_at = now();
end;
$$;

-- Creates (package null) or changes one of the caller's packages. Returns its id.
create function public.save_package(package uuid, title text, kind text, price_paise bigint, live boolean)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  id_ uuid;
begin
  if uid is null or not exists (select 1 from public.coach_profiles where coach_id = uid) then
    raise exception 'not_coach' using errcode = '42501';
  end if;
  if char_length(btrim(coalesce(title, ''))) not between 1 and 80 or kind is null or kind not in ('monthly', 'single') or live is null then
    raise exception 'bad_package' using errcode = '22023';
  end if;
  if price_paise is null or price_paise not between 1 and 100000000 then
    raise exception 'bad_price' using errcode = '22023';
  end if;
  if package is null then
    insert into public.packages (coach_id, title, kind, price_paise, live)
    values (uid, btrim(title), kind, price_paise, live) returning id into id_;
  else
    update public.packages p set title = btrim(save_package.title), kind = save_package.kind, price_paise = save_package.price_paise, live = save_package.live
    where p.id = package and p.coach_id = uid returning p.id into id_;
    if id_ is null then
      raise exception 'not_owner' using errcode = '42501';
    end if;
  end if;
  return id_;
end;
$$;

-- Replaces all of the caller's weekly slots: [{dow, start: "HH:MM", minutes}].
create function public.set_slots(slots jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  s jsonb;
begin
  if uid is null or not exists (select 1 from public.coach_profiles where coach_id = uid) then
    raise exception 'not_coach' using errcode = '42501';
  end if;
  if jsonb_typeof(coalesce(slots, '[]')) <> 'array' or jsonb_array_length(coalesce(slots, '[]')) > 50 then
    raise exception 'bad_slot' using errcode = '22023';
  end if;
  delete from public.availability_slots where coach_id = uid;
  for s in select value from jsonb_array_elements(coalesce(slots, '[]')) loop
    if (s->>'dow') !~ '^[1-7]$' or (s->>'start') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
      or (s->>'minutes') !~ '^[0-9]{2,3}$' or (s->>'minutes')::int not between 15 and 240 then
      raise exception 'bad_slot' using errcode = '22023';
    end if;
    insert into public.availability_slots (coach_id, dow, start_time, minutes)
    values (uid, (s->>'dow')::smallint, (s->>'start')::time, (s->>'minutes')::smallint);
  end loop;
end;
$$;

-- Records a credential the coach uploaded to their own folder in the bucket. Returns its id.
create function public.submit_credential(title text, file_path text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  id_ uuid;
begin
  if uid is null or not exists (select 1 from public.coach_profiles where coach_id = uid) then
    raise exception 'not_coach' using errcode = '42501';
  end if;
  if char_length(btrim(coalesce(title, ''))) not between 1 and 120 then
    raise exception 'bad_credential' using errcode = '22023';
  end if;
  -- Own folder, one plain file name: no "..", no sub-folders, no other coach's folder.
  if coalesce(file_path, '') !~ ('^' || uid::text || '/[A-Za-z0-9._-]{1,120}$') or file_path like '%..%' then
    raise exception 'bad_path' using errcode = '22023';
  end if;
  insert into public.credentials (coach_id, title, file_path) values (uid, btrim(title), file_path) returning id into id_;
  return id_;
end;
$$;

revoke execute on function public.coach_is_live(uuid) from public;
grant execute on function public.coach_is_live(uuid) to anon, authenticated;
revoke execute on function public.save_coach_profile(text, text, text[], text[], text[], text, int, int), public.save_package(uuid, text, text, bigint, boolean),
  public.set_slots(jsonb), public.submit_credential(text, text) from public, anon;
grant execute on function public.save_coach_profile(text, text, text[], text[], text[], text, int, int), public.save_package(uuid, text, text, bigint, boolean),
  public.set_slots(jsonb), public.submit_credential(text, text) to authenticated;

-- The private bucket for credential files. A coach writes and reads only their own folder; admins read all.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('credentials', 'credentials', false, 10485760, array['application/pdf', 'image/jpeg', 'image/png'])
on conflict (id) do nothing;
create policy credentials_files_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'credentials' and (storage.foldername(name))[1] = (select auth.uid())::text and public.has_role('coach'));
create policy credentials_files_select on storage.objects for select to authenticated
  using (bucket_id = 'credentials' and ((storage.foldername(name))[1] = (select auth.uid())::text or (select public.is_admin())));
