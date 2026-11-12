-- M1-04: sign-up steps 2 to 4. Per-sport answers sit on athlete_prefs rows (decision D5).
-- Health data (injury notes, body metrics) lives apart from profiles. The AI may use each kind only after
-- its own consent row says yes (risk R6): ai_health_personalisation for injury notes, ai_body_metrics for weight and height.

alter type public.consent_purpose add value 'ai_body_metrics';
-- Which notice text the user answered, so an old yes cannot cover new wording.
alter table public.consents add column notice_version text not null default 'v0';

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

-- Every step after 1 needs a saved date of birth.
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

-- Adds a consent row only when the answer or the notice differs from the newest row, so the log holds real decisions.
create function public.record_consent(uid uuid, what public.consent_purpose, answer boolean, notice text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  last record;
begin
  if answer is null then
    raise exception 'consent_required' using errcode = '22023';
  end if;
  if coalesce(btrim(notice), '') = '' or char_length(notice) > 40 then
    raise exception 'bad_notice' using errcode = '22023';
  end if;
  select granted, notice_version into last from public.consents
  where user_id = uid and purpose = what order by created_at desc limit 1;
  if not found or last.granted <> answer or last.notice_version <> notice then
    insert into public.consents (user_id, purpose, granted, notice_version) values (uid, what, answer, notice);
  end if;
end;
$$;

-- Writes {sport: {question: answer}} onto the user's athlete_prefs rows. Answers are short strings or lists of them,
-- so no free text reaches coach screens or AI prompts through this path. Any sport works (D5).
create function public.apply_sport_answers(uid uuid, by_sport jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  sport text;
  given jsonb;
begin
  if jsonb_typeof(coalesce(by_sport, '{}')) <> 'object' then
    raise exception 'answers_not_object' using errcode = '22023';
  end if;
  for sport, given in select key, value from jsonb_each(coalesce(by_sport, '{}')) loop
    if jsonb_typeof(given) <> 'object' then
      raise exception 'answers_not_object' using errcode = '22023';
    end if;
    if exists (
      select 1 from jsonb_each(given) a
      where char_length(a.key) > 40
        or not (
          (jsonb_typeof(a.value) = 'string' and char_length(a.value #>> '{}') <= 40)
          or (jsonb_typeof(a.value) = 'array' and jsonb_array_length(a.value) <= 20
              and not exists (select 1 from jsonb_array_elements(a.value) e where jsonb_typeof(e) <> 'string' or char_length(e #>> '{}') > 40))
        )
    ) then
      raise exception 'bad_answer' using errcode = '22023';
    end if;
    update public.athlete_prefs set answers = given where user_id = uid and category_id = sport;
    if not found then
      raise exception 'sport_not_chosen' using errcode = '22023';
    end if;
  end loop;
end;
$$;

-- Step 2 in one transaction: basics, the injury-notes consent, and any sport answers.
create function public.save_training_basics(days int, equipment text[], injury_notes text, ai_consent boolean, notice text, sport_answers jsonb)
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

  insert into public.athlete_basics (user_id, days_per_week, equipment, injury_notes)
  values (uid, days, coalesce(equipment, '{}'), notes)
  on conflict (user_id) do update set days_per_week = excluded.days_per_week, equipment = excluded.equipment, injury_notes = excluded.injury_notes;
  perform public.record_consent(uid, 'ai_health_personalisation', ai_consent, notice);
  perform public.apply_sport_answers(uid, sport_answers);
end;
$$;

-- Step 3 in one transaction: sport answers, the body-metrics consent, and the current measurements.
-- Sign-up edits the latest measurement rather than logging a new one, so a typo can be fixed and both fields
-- cleared removes it. A history of measurements starts with the progress screens (M5).
create function public.save_body_metrics(weight_kg numeric, height_cm numeric, ai_consent boolean, notice text, sport_answers jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := public.require_step1();
  latest uuid;
begin
  if weight_kg is not null and weight_kg not between 20 and 400 then
    raise exception 'bad_weight' using errcode = '22023';
  end if;
  if height_cm is not null and height_cm not between 100 and 250 then
    raise exception 'bad_height' using errcode = '22023';
  end if;

  perform public.record_consent(uid, 'ai_body_metrics', ai_consent, notice);
  perform public.apply_sport_answers(uid, sport_answers);

  select id into latest from public.body_metrics where user_id = uid order by measured_at desc limit 1 for update;
  if weight_kg is null and height_cm is null then
    delete from public.body_metrics where id = latest;
  elsif latest is null then
    insert into public.body_metrics (user_id, weight_kg, height_cm) values (uid, weight_kg, height_cm);
  else
    update public.body_metrics set weight_kg = save_body_metrics.weight_kg, height_cm = save_body_metrics.height_cm, measured_at = clock_timestamp() where id = latest;
  end if;
end;
$$;

revoke all on public.athlete_basics, public.body_metrics from anon, authenticated;
grant all on public.athlete_basics, public.body_metrics to service_role;
grant select on public.athlete_basics, public.body_metrics to authenticated;
revoke execute on function public.require_step1(), public.record_consent(uuid, public.consent_purpose, boolean, text),
  public.apply_sport_answers(uuid, jsonb), public.save_training_basics(int, text[], text, boolean, text, jsonb),
  public.save_body_metrics(numeric, numeric, boolean, text, jsonb) from public, anon, authenticated;
grant execute on function public.save_training_basics(int, text[], text, boolean, text, jsonb),
  public.save_body_metrics(numeric, numeric, boolean, text, jsonb) to authenticated;

alter table public.athlete_basics enable row level security;
alter table public.body_metrics enable row level security;
create policy athlete_basics_select_own on public.athlete_basics for select to authenticated using (user_id = (select auth.uid()));
create policy body_metrics_select_own on public.body_metrics for select to authenticated using (user_id = (select auth.uid()));
