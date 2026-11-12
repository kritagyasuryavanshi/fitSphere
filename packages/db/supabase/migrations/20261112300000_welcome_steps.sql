-- M1-04: sign-up steps 2 to 4. Per-sport answers sit on athlete_prefs rows (decision D5).
-- Health data (injury notes, body metrics) lives apart from profiles, and the AI may use it only after a consent row says yes (risk R6).

alter table public.athlete_prefs add column answers jsonb not null default '{}';

create table public.athlete_basics (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  days_per_week smallint not null check (days_per_week between 1 and 7),
  equipment text[] not null default '{}',
  injury_notes text not null default '' check (char_length(injury_notes) <= 500),
  updated_at timestamptz not null default now()
);
create trigger athlete_basics_set_updated_at before update on public.athlete_basics
  for each row execute function public.set_updated_at();

create table public.body_metrics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  weight_kg numeric(5, 1) check (weight_kg between 20 and 400),
  height_cm numeric(4, 1) check (height_cm between 100 and 250),
  measured_at timestamptz not null default clock_timestamp(),
  check (weight_kg is not null or height_cm is not null)
);
create index body_metrics_user_idx on public.body_metrics (user_id, measured_at desc);

-- Every step after 1 needs a saved date of birth, so nobody skips the 18+ check.
create function public.require_step1()
returns uuid
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
  if not exists (select 1 from public.profiles where id = uid and date_of_birth is not null) then
    raise exception 'step1_required' using errcode = '22023';
  end if;
  return uid;
end;
$$;

create function public.save_training_basics(days int, equipment text[], injury_notes text, ai_consent boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := public.require_step1();
  notes text := btrim(coalesce(injury_notes, ''));
begin
  if days is null or days not between 1 and 7 then
    raise exception 'bad_days' using errcode = '22023';
  end if;
  if char_length(notes) > 500 then
    raise exception 'notes_too_long' using errcode = '22023';
  end if;
  if coalesce(cardinality(equipment), 0) > 20 or exists (select 1 from unnest(equipment) e where e is null or char_length(e) > 40) then
    raise exception 'bad_equipment' using errcode = '22023';
  end if;
  -- The consent must be an explicit answer, never assumed.
  if ai_consent is null then
    raise exception 'consent_required' using errcode = '22023';
  end if;

  insert into public.athlete_basics (user_id, days_per_week, equipment, injury_notes)
  values (uid, days, coalesce(equipment, '{}'), notes)
  on conflict (user_id) do update set days_per_week = excluded.days_per_week, equipment = excluded.equipment, injury_notes = excluded.injury_notes;
  insert into public.consents (user_id, purpose, granted) values (uid, 'ai_health_personalisation', ai_consent);
end;
$$;

-- One function for every sport; the app checks the answer values for each sport.
create function public.save_sport_answers(category text, answers jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := public.require_step1();
begin
  if jsonb_typeof(answers) is distinct from 'object' then
    raise exception 'answers_not_object' using errcode = '22023';
  end if;
  if pg_column_size(answers) > 4000 then
    raise exception 'answers_too_big' using errcode = '22023';
  end if;
  update public.athlete_prefs set answers = save_sport_answers.answers where user_id = uid and category_id = category;
  if not found then
    raise exception 'sport_not_chosen' using errcode = '22023';
  end if;
end;
$$;

create function public.log_body_metrics(weight_kg numeric, height_cm numeric)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := public.require_step1();
begin
  if weight_kg is not null and weight_kg not between 20 and 400 then
    raise exception 'bad_weight' using errcode = '22023';
  end if;
  if height_cm is not null and height_cm not between 100 and 250 then
    raise exception 'bad_height' using errcode = '22023';
  end if;
  if weight_kg is null and height_cm is null then
    return;
  end if;
  insert into public.body_metrics (user_id, weight_kg, height_cm) values (uid, weight_kg, height_cm);
end;
$$;

revoke all on public.athlete_basics, public.body_metrics from anon, authenticated;
grant all on public.athlete_basics, public.body_metrics to service_role;
grant select on public.athlete_basics, public.body_metrics to authenticated;
revoke execute on function public.require_step1(), public.save_training_basics(int, text[], text, boolean),
  public.save_sport_answers(text, jsonb), public.log_body_metrics(numeric, numeric) from public, anon;
revoke execute on function public.require_step1() from authenticated;
grant execute on function public.save_training_basics(int, text[], text, boolean), public.save_sport_answers(text, jsonb),
  public.log_body_metrics(numeric, numeric) to authenticated;

alter table public.athlete_basics enable row level security;
alter table public.body_metrics enable row level security;
create policy athlete_basics_select_own on public.athlete_basics for select to authenticated using (user_id = (select auth.uid()));
create policy body_metrics_select_own on public.body_metrics for select to authenticated using (user_id = (select auth.uid()));
