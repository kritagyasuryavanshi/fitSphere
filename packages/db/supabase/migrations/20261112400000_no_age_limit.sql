-- 2026-11-12, owner decision: no age limit. The date of birth is still asked once and kept,
-- so minors stay identifiable for the parental-consent step needed before launch (India's DPDP Act).
-- Also: saving step 1 again keeps the answers of sports still chosen (M1-04 review).

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

  select date_of_birth into saved_dob from public.profiles where id = uid for update;
  if not found then
    raise exception 'no_profile' using errcode = '42501';
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

drop function public.is_adult(date, date);
