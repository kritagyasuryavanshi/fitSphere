-- M1-03: sign-up step 1. Sports are rows (architecture 4.3); M2-01 extends categories with content.

create table public.categories (
  id text primary key,
  name text not null,
  tagline text not null default '',
  is_live boolean not null default true,
  sort int not null default 0
);
insert into public.categories (id, name, tagline, is_live, sort) values
  ('boxing', 'Boxing', 'Technique, footwork, defence', true, 1),
  ('sc', 'Strength & Conditioning', 'Built for the ring', true, 2),
  ('gym', 'Gym & Fitness', 'Muscle, fat loss, strength', true, 3),
  ('cricket', 'Cricket', 'Coming later', false, 4);

-- One row per sport a user trains. M1-04 adds the per-sport answers as columns.
create table public.athlete_prefs (
  user_id uuid not null references public.profiles (id) on delete cascade,
  category_id text not null references public.categories (id),
  created_at timestamptz not null default now(),
  primary key (user_id, category_id)
);
create index athlete_prefs_category_idx on public.athlete_prefs (category_id);

-- The only way to write step 1. The age check runs here, on India's date, whatever the browser sent.
create function public.complete_about_you(first_name text, birth_date date, sports text[])
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
  if birth_date > ((now() at time zone 'Asia/Kolkata')::date - interval '18 years')::date then
    raise exception 'under_18';
  end if;
  if name = '' or name is null then
    raise exception 'name_required' using errcode = '22023';
  end if;
  if coalesce(cardinality(sports), 0) = 0 then
    raise exception 'sport_required' using errcode = '22023';
  end if;
  if exists (select 1 from unnest(sports) s where s not in (select id from public.categories where is_live)) then
    raise exception 'unknown_sport' using errcode = '22023';
  end if;

  select date_of_birth into saved_dob from public.profiles where id = uid for update;
  if not found then
    raise exception 'no profile' using errcode = '42501';
  end if;
  -- "We check this once": the first date stands.
  if saved_dob is not null and saved_dob <> birth_date then
    raise exception 'dob_locked' using errcode = '22023';
  end if;

  update public.profiles set display_name = left(name, 80), date_of_birth = birth_date where id = uid;
  delete from public.athlete_prefs where user_id = uid;
  insert into public.athlete_prefs (user_id, category_id) select distinct uid, s from unnest(sports) s;
end;
$$;

revoke all on public.categories, public.athlete_prefs from anon, authenticated;
grant all on public.categories, public.athlete_prefs to service_role;
grant select on public.categories to anon, authenticated;
grant select on public.athlete_prefs to authenticated;
revoke execute on function public.complete_about_you(text, date, text[]) from public, anon;
grant execute on function public.complete_about_you(text, date, text[]) to authenticated;

alter table public.categories enable row level security;
alter table public.athlete_prefs enable row level security;
create policy categories_select_all on public.categories for select to anon, authenticated using (true);
create policy athlete_prefs_select_own on public.athlete_prefs for select to authenticated using (user_id = (select auth.uid()));
create policy athlete_prefs_select_admin on public.athlete_prefs for select to authenticated using ((select public.is_admin()));
