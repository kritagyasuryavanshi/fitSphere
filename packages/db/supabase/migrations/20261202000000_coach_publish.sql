-- M4-02: the coach's own profile editor (X-CoachProfile). The coach reads their full row (the private columns too)
-- through my_coach_profile, accepts the current coach agreement, and only then publishes. Publishing needs a headline
-- and at least one live package; a suspended coach cannot publish. Owner decision O-05 replaces the agreement text;
-- bumping current_coach_agreement then asks every coach to accept again before they can publish.

-- The version coaches must accept. The text lives in apps/web/src/lib/coach-agreement.ts under the same version.
create function public.current_coach_agreement()
returns text
language sql
immutable
set search_path = ''
as $$
  select 'draft-2026-11'::text;
$$;

create function public.my_coach_profile()
returns setof public.coach_profiles
language sql
stable
security definer
set search_path = ''
as $$
  select * from public.coach_profiles where coach_id = auth.uid();
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
