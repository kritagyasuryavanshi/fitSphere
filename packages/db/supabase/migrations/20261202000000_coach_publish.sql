-- M4-02: the coach's own profile editor (X-CoachProfile). The coach reads their full row (the private columns too)
-- through my_coach_profile, accepts the current coach agreement, and only then publishes. Publishing needs a headline
-- and at least one live package; a suspended coach cannot publish. Owner decision O-05 replaces the agreement text;
-- bumping current_coach_agreement then asks every coach to accept again before they can publish.

-- The version coaches must accept. The text lives in apps/web/src/lib/coach-agreement.ts under the same version.
create function public.current_coach_agreement()
returns text
language sql
stable
set search_path = ''
as $$
  select 'draft-2026-11'::text;
$$;

create function public.my_coach_profile()
returns table (coach_id uuid, headline text, philosophy text, specialties text[], languages text[], formats text[], city text, years smallint,
  client_limit smallint, agreement_version text, agreement_accepted_at timestamptz, status text, updated_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  -- No payout_account_id: the M4-01 column grants keep it from every client, the coach included.
  select p.coach_id, p.headline, p.philosophy, p.specialties, p.languages, p.formats, p.city, p.years, p.client_limit,
    p.agreement_version, p.agreement_accepted_at, p.status, p.updated_at
  from public.coach_profiles p where p.coach_id = auth.uid();
$$;

create function public.accept_coach_agreement(version text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null or not public.has_role('coach') or not exists (select 1 from public.coach_profiles where coach_id = uid) then
    raise exception 'not_coach' using errcode = '42501';
  end if;
  if version is distinct from public.current_coach_agreement() then
    raise exception 'bad_version' using errcode = '22023';
  end if;
  update public.coach_profiles set agreement_version = version, agreement_accepted_at = now(), updated_at = now() where coach_id = uid;
end;
$$;

-- Publish (true) or unpublish (false) the caller's profile.
create function public.set_profile_live(live boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  p public.coach_profiles;
begin
  if uid is null or not public.has_role('coach') then
    raise exception 'not_coach' using errcode = '42501';
  end if;
  select * into p from public.coach_profiles where coach_id = uid for update;
  if p.coach_id is null then
    raise exception 'not_coach' using errcode = '42501';
  end if;
  if p.status = 'suspended' then
    raise exception 'suspended' using errcode = '42501';
  end if;
  if live then
    if p.agreement_version is distinct from public.current_coach_agreement() then
      raise exception 'agreement_needed' using errcode = '22023';
    end if;
    if btrim(p.headline) = '' then
      raise exception 'headline_needed' using errcode = '22023';
    end if;
    if not exists (select 1 from public.packages where coach_id = uid and packages.live) then
      raise exception 'package_needed' using errcode = '22023';
    end if;
  end if;
  update public.coach_profiles set status = case when live then 'live' else 'draft' end, updated_at = now() where coach_id = uid;
end;
$$;

-- Raises when a live profile has lost what going live needed: a headline and at least one live package.
create function public.assert_live_ready(coach uuid)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from public.coach_profiles where coach_id = coach and status = 'live') then
    if exists (select 1 from public.coach_profiles where coach_id = coach and btrim(headline) = '') then
      raise exception 'live_needs_headline' using errcode = '22023';
    end if;
    if not exists (select 1 from public.packages where coach_id = coach and live) then
      raise exception 'live_needs_package' using errcode = '22023';
    end if;
  end if;
end;
$$;
revoke execute on function public.assert_live_ready(uuid) from public, anon, authenticated;

-- coach_is_live as in 20261130000000_marketplace_profiles.sql, plus the current agreement: a new version takes a
-- coach out of public view until they accept it again.
create or replace function public.coach_is_live(coach uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.coach_profiles where coach_id = coach and status = 'live' and agreement_version = public.current_coach_agreement())
    and exists (select 1 from public.user_roles where user_id = coach and role = 'coach');
$$;

-- save_coach_profile as in 20261130000000_marketplace_profiles.sql, plus the live check.
create or replace function public.save_coach_profile(headline text, philosophy text, specialties text[], languages text[], formats text[], city text, years int, client_limit int)
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
    or exists (select 1 from unnest(coalesce(specialties, '{}') || coalesce(languages, '{}')) x where x is null or char_length(btrim(x)) not between 1 and 40)
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
  perform public.assert_live_ready(uid);
end;
$$;

-- save_package as in 20261130000000_marketplace_profiles.sql, plus the live check.
create or replace function public.save_package(package uuid, title text, kind text, price_paise bigint, live boolean)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  id_ uuid;
begin
  if uid is null or not public.has_role('coach') or not exists (select 1 from public.coach_profiles where coach_id = uid) then
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
  perform public.assert_live_ready(uid);
  return id_;
end;
$$;

revoke execute on function public.my_coach_profile(), public.accept_coach_agreement(text), public.set_profile_live(boolean) from public, anon;
grant execute on function public.my_coach_profile(), public.accept_coach_agreement(text), public.set_profile_live(boolean) to authenticated;
grant execute on function public.current_coach_agreement() to anon, authenticated;

-- The public name of a live coach (profiles is private). Null for anyone not live, so it reveals nothing else.
create function public.coach_public_name(coach uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case when public.coach_is_live(coach) then coalesce(nullif((select display_name from public.profiles where id = coach), ''), 'Coach') end;
$$;
revoke execute on function public.coach_public_name(uuid) from public;
grant execute on function public.coach_public_name(uuid) to anon, authenticated;
