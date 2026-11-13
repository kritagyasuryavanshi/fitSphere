-- M3-01: coach programs (architecture 4.2). A program has versions: one draft the coach edits, and frozen
-- published versions. Athletes follow the newest version that is in effect on a date (M3-05).
-- Clients never write these rows; create_program, save_program_draft and publish_program do.

create type public.prescription_type as enum ('rounds', 'time', 'sets');

create table public.programs (
  id uuid primary key default gen_random_uuid(),
  -- Null once the coach deletes their account; enrolled athletes keep the plan.
  coach_id uuid references public.profiles (id) on delete set null,
  category_id text not null references public.categories (id),
  title text not null check (char_length(btrim(title)) between 1 and 120),
  summary text not null default '' check (char_length(summary) <= 500),
  weeks smallint not null default 4 check (weeks between 1 and 26),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index programs_coach_idx on public.programs (coach_id);
create index programs_category_idx on public.programs (category_id);
create trigger programs_set_updated_at before update on public.programs
  for each row execute function public.set_updated_at();

create table public.program_versions (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.programs (id) on delete cascade,
  version int not null,
  published_at timestamptz,
  -- The first India date this version applies to.
  effective_from date,
  created_at timestamptz not null default now(),
  unique (program_id, version),
  check ((published_at is null) = (effective_from is null))
);
-- One draft per program.
create unique index program_versions_one_draft on public.program_versions (program_id) where published_at is null;

create table public.program_sessions (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null references public.program_versions (id) on delete cascade,
  week smallint not null check (week between 1 and 26),
  day smallint not null check (day between 1 and 7),
  position smallint not null default 1,
  title text not null default '' check (char_length(title) <= 80)
);
create index program_sessions_version_idx on public.program_sessions (version_id, week, day, position);

create table public.session_items (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.program_sessions (id) on delete cascade,
  position smallint not null,
  item_id uuid not null references public.content_items (id),
  type public.prescription_type not null,
  prescription jsonb not null,
  cue text not null default '' check (char_length(cue) <= 200),
  unique (session_id, position)
);
create index session_items_item_idx on public.session_items (item_id);

-- The numbers each prescription type needs, as whole numbers in sane ranges. load_kg may be a decimal.
create function public.valid_prescription(t public.prescription_type, p jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  -- A missing number makes the expression null; null counts as invalid, also in the check constraint.
  select coalesce(jsonb_typeof(p) = 'object' and case t
    when 'rounds' then (p->>'rounds') ~ '^\d{1,2}$' and (p->>'rounds')::int between 1 and 30
      and (p->>'work_s') ~ '^\d{1,4}$' and (p->>'work_s')::int between 10 and 3600
      and (p->>'rest_s') ~ '^\d{1,4}$' and (p->>'rest_s')::int between 0 and 1800
    when 'time' then (p->>'seconds') ~ '^\d{1,5}$' and (p->>'seconds')::int between 10 and 14400
    when 'sets' then (p->>'sets') ~ '^\d{1,2}$' and (p->>'sets')::int between 1 and 20
      and (p->>'reps') ~ '^\d{1,3}$' and (p->>'reps')::int between 1 and 200
      and (p->'load_kg' is null or ((p->>'load_kg') ~ '^\d{1,3}(\.\d{1,2})?$' and (p->>'load_kg')::numeric <= 500))
  end, false);
$$;
alter table public.session_items add constraint session_items_prescription_valid check (public.valid_prescription(type, prescription));

-- Today's date in India, where every athlete trains in v1.
create function public.india_today()
returns date
language sql
stable
set search_path = ''
as $$
  select (now() at time zone 'Asia/Kolkata')::date;
$$;

create function public.create_program(title text, category text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  program uuid;
begin
  if not public.has_role('coach') then
    raise exception 'not_coach' using errcode = '42501';
  end if;
  if not exists (select 1 from public.categories where id = category and is_live) then
    raise exception 'bad_category' using errcode = '22023';
  end if;
  insert into public.programs (coach_id, category_id, title) values (uid, category, btrim(coalesce(title, ''))) returning id into program;
  insert into public.program_versions (program_id, version) values (program, 1);
  return program;
end;
$$;

-- The caller's draft version of a program they own, locked.
create function public.own_draft(program uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  draft uuid;
begin
  perform 1 from public.programs where id = program and coach_id = auth.uid() for update;
  if not found or not public.has_role('coach') then
    raise exception 'not_owner' using errcode = '42501';
  end if;
  select id into draft from public.program_versions where program_id = program and published_at is null;
  return draft;
end;
$$;

-- Replaces the whole draft: [{week, day, title, items: [{item, type, ...numbers, cue}]}]. The builder sends its full state.
create function public.save_program_draft(program uuid, title text, summary text, weeks int, sessions jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  draft uuid := public.own_draft(program);
  s jsonb;
  i jsonb;
  sn int;
  n int;
  session uuid;
begin
  if jsonb_typeof(coalesce(sessions, '[]')) <> 'array' or jsonb_array_length(coalesce(sessions, '[]')) > 200 then
    raise exception 'bad_sessions' using errcode = '22023';
  end if;
  if weeks is null or weeks not between 1 and 26 then
    raise exception 'bad_weeks' using errcode = '22023';
  end if;
  update public.programs set title = btrim(coalesce(save_program_draft.title, '')), summary = left(btrim(coalesce(save_program_draft.summary, '')), 500),
    weeks = save_program_draft.weeks where id = program;
  delete from public.program_sessions where version_id = draft;

  for s, sn in select value, ordinality from jsonb_array_elements(coalesce(sessions, '[]')) with ordinality loop
    if (s->>'week') !~ '^\d{1,2}$' or (s->>'week')::int not between 1 and weeks or (s->>'day') !~ '^\d$' or (s->>'day')::int not between 1 and 7 then
      raise exception 'bad_day' using errcode = '22023';
    end if;
    if jsonb_typeof(coalesce(s->'items', '[]')) <> 'array' or jsonb_array_length(coalesce(s->'items', '[]')) > 30 then
      raise exception 'bad_items' using errcode = '22023';
    end if;
    insert into public.program_sessions (version_id, week, day, position, title)
    values (draft, (s->>'week')::int, (s->>'day')::int, sn, left(btrim(coalesce(s->>'title', '')), 80))
    returning id into session;
    for i, n in select value, ordinality from jsonb_array_elements(coalesce(s->'items', '[]')) with ordinality loop
      if (i->>'item') !~ '^[0-9a-f-]{36}$' or not exists (select 1 from public.content_items where id = (i->>'item')::uuid and status = 'published') then
        raise exception 'item_not_published' using errcode = '22023';
      end if;
      if (i->>'type') not in ('rounds', 'time', 'sets')
        or not public.valid_prescription((i->>'type')::public.prescription_type, i - 'item' - 'type' - 'cue') then
        raise exception 'bad_prescription' using errcode = '22023';
      end if;
      insert into public.session_items (session_id, position, item_id, type, prescription, cue)
      values (session, n, (i->>'item')::uuid, (i->>'type')::public.prescription_type, i - 'item' - 'type' - 'cue', left(btrim(coalesce(i->>'cue', '')), 200));
    end loop;
  end loop;
end;
$$;

-- Freezes the draft as a published version and opens a new draft as a copy. Enrolled athletes see a new
-- version from tomorrow, so a session they are doing today does not change under them. The first is live today.
create function public.publish_program(program uuid)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  draft uuid := public.own_draft(program);
  v int;
  next_draft uuid;
  s record;
  copy uuid;
begin
  if not exists (select 1 from public.program_sessions where version_id = draft) then
    raise exception 'empty_program' using errcode = '22023';
  end if;
  if btrim((select title from public.programs where id = program)) = '' then
    raise exception 'title_required' using errcode = '22023';
  end if;
  update public.program_versions set published_at = now(),
    effective_from = case when exists (select 1 from public.program_versions where program_id = program and published_at is not null)
                          then public.india_today() + 1 else public.india_today() end
  where id = draft returning version into v;

  insert into public.program_versions (program_id, version) values (program, v + 1) returning id into next_draft;
  for s in select * from public.program_sessions where version_id = draft order by position loop
    insert into public.program_sessions (version_id, week, day, position, title) values (next_draft, s.week, s.day, s.position, s.title) returning id into copy;
    insert into public.session_items (session_id, position, item_id, type, prescription, cue)
      select copy, position, item_id, type, prescription, cue from public.session_items where session_id = s.id;
  end loop;
  return v;
end;
$$;

revoke all on public.programs, public.program_versions, public.program_sessions, public.session_items from anon, authenticated;
grant all on public.programs, public.program_versions, public.program_sessions, public.session_items to service_role;
grant select on public.programs, public.program_versions, public.program_sessions, public.session_items to anon, authenticated;
revoke execute on function public.create_program(text, text), public.own_draft(uuid), public.save_program_draft(uuid, text, text, int, jsonb),
  public.publish_program(uuid), public.valid_prescription(public.prescription_type, jsonb), public.india_today() from public, anon;
grant execute on function public.create_program(text, text), public.save_program_draft(uuid, text, text, int, jsonb), public.publish_program(uuid) to authenticated;
-- The check constraint and later functions call these as any role.
grant execute on function public.valid_prescription(public.prescription_type, jsonb), public.india_today() to anon, authenticated;
revoke execute on function public.own_draft(uuid) from authenticated;

alter table public.programs enable row level security;
alter table public.program_versions enable row level security;
alter table public.program_sessions enable row level security;
alter table public.session_items enable row level security;

-- Policy helpers. Security definer, so the programs and versions policies do not recurse into each other.
create function public.owns_program(program uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.programs where id = program and coach_id = auth.uid());
$$;
create function public.program_is_published(program uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.program_versions where program_id = program and published_at is not null);
$$;
revoke execute on function public.owns_program(uuid), public.program_is_published(uuid) from public;
grant execute on function public.owns_program(uuid), public.program_is_published(uuid) to anon, authenticated;

-- The coach sees everything of their own; everyone sees programs with a published version and those versions.
create policy programs_select_own on public.programs for select to authenticated using (coach_id = (select auth.uid()));
create policy programs_select_published on public.programs for select to anon, authenticated using (public.program_is_published(id));
create policy program_versions_select_published on public.program_versions for select to anon, authenticated using (published_at is not null);
create policy program_versions_select_own on public.program_versions for select to authenticated using (public.owns_program(program_id));
-- Child rows follow their version: the subquery runs under the policies above.
create policy program_sessions_select_visible on public.program_sessions for select to anon, authenticated
  using (exists (select 1 from public.program_versions v where v.id = version_id));
create policy session_items_select_visible on public.session_items for select to anon, authenticated
  using (exists (select 1 from public.program_sessions s where s.id = session_id));
