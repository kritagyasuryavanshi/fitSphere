-- M2-01: the content graph (architecture 4.2) and its review workflow: draft -> in_review -> published.
-- Clients never write content rows. Only published items are public. Only a reviewer or admin publishes,
-- and never their own item. The coach draft-save function comes with the editor (M2-08).

create type public.content_kind as enum ('skill', 'drill', 'exercise');
create type public.content_level as enum ('beginner', 'intermediate', 'advanced');
create type public.content_status as enum ('draft', 'in_review', 'needs_changes', 'published');
create type public.content_link_kind as enum ('prerequisite', 'related', 'alternative');

-- What a category asks of its items, as data, so a new category needs rows only (decision D5).
alter table public.categories
  add column uses_supports boolean not null default false,
  add column uses_muscles boolean not null default false;
update public.categories set uses_supports = true where id = 'sc';
update public.categories set uses_muscles = true where id = 'gym';

create table public.disciplines (
  id uuid primary key default gen_random_uuid(),
  category_id text not null references public.categories (id),
  slug text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null,
  sort int not null default 0,
  unique (category_id, slug)
);
insert into public.disciplines (category_id, slug, name, sort) values
  ('boxing', 'technical', 'Technical boxing', 1), ('boxing', 'defence', 'Defence', 2),
  ('boxing', 'footwork', 'Footwork', 3), ('boxing', 'combinations', 'Combinations', 4),
  ('sc', 'strength', 'Strength', 1), ('sc', 'power', 'Power', 2), ('sc', 'conditioning', 'Conditioning', 3),
  ('sc', 'core', 'Core', 4), ('sc', 'mobility', 'Mobility', 5),
  ('gym', 'chest', 'Chest', 1), ('gym', 'back', 'Back', 2), ('gym', 'legs', 'Legs', 3),
  ('gym', 'shoulders', 'Shoulders', 4), ('gym', 'arms', 'Arms', 5), ('gym', 'core', 'Core', 6);

create table public.muscles (
  id text primary key check (id ~ '^[a-z0-9_]+$'),
  name text not null,
  muscle_group text not null,
  sort int not null default 0
);
insert into public.muscles (id, name, muscle_group, sort) values
  ('chest', 'Chest', 'chest', 1), ('upper_chest', 'Upper chest', 'chest', 2),
  ('lats', 'Lats', 'back', 3), ('upper_back', 'Upper back', 'back', 4), ('lower_back', 'Lower back', 'back', 5),
  ('quads', 'Quads', 'legs', 6), ('hamstrings', 'Hamstrings', 'legs', 7), ('glutes', 'Glutes', 'legs', 8), ('calves', 'Calves', 'legs', 9),
  ('front_shoulders', 'Front shoulders', 'shoulders', 10), ('side_shoulders', 'Side shoulders', 'shoulders', 11), ('rear_shoulders', 'Rear shoulders', 'shoulders', 12),
  ('biceps', 'Biceps', 'arms', 13), ('triceps', 'Triceps', 'arms', 14), ('forearms', 'Forearms', 'arms', 15),
  ('abs', 'Abs', 'core', 16), ('obliques', 'Obliques', 'core', 17);

create table public.content_items (
  id uuid primary key default gen_random_uuid(),
  discipline_id uuid not null references public.disciplines (id),
  -- Null once the author deletes their account; published items stay.
  author_id uuid references public.profiles (id) on delete set null,
  kind public.content_kind not null,
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 80),
  title text not null check (char_length(btrim(title)) between 1 and 120),
  summary text not null default '' check (char_length(summary) <= 500),
  level public.content_level not null default 'beginner',
  duration_min smallint check (duration_min between 1 and 240),
  equipment text[] not null default '{}',
  environments text[] not null default '{}',
  drill_type text check (drill_type ~ '^[a-z_]+$'),
  -- S&C: the boxing qualities an item builds, for example punching_power.
  supports text[] not null default '{}',
  video_id text check (video_id ~ '^[A-Za-z0-9_-]{11}$'),
  video_broken boolean not null default false,
  mistakes text not null default '' check (char_length(mistakes) <= 1000),
  safety text not null default '' check (char_length(safety) <= 1000),
  -- Dose guidance rows, for example the gym rep range per goal.
  dose jsonb not null default '[]' check (jsonb_typeof(dose) = 'array'),
  is_sample boolean not null default false,
  status public.content_status not null default 'draft',
  review_note text check (char_length(review_note) <= 1000),
  reviewed_by uuid references public.profiles (id) on delete set null,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index content_items_discipline_idx on public.content_items (discipline_id, status);
create index content_items_author_idx on public.content_items (author_id);
create index content_items_reviewed_by_idx on public.content_items (reviewed_by);
create trigger content_items_set_updated_at before update on public.content_items
  for each row execute function public.set_updated_at();

create table public.content_steps (
  item_id uuid not null references public.content_items (id) on delete cascade,
  position smallint not null check (position between 1 and 30),
  body text not null check (char_length(btrim(body)) between 1 and 500),
  primary key (item_id, position)
);

create table public.content_links (
  from_id uuid not null references public.content_items (id) on delete cascade,
  to_id uuid not null references public.content_items (id) on delete cascade,
  kind public.content_link_kind not null,
  sort int not null default 0,
  primary key (from_id, to_id, kind),
  check (from_id <> to_id)
);
create index content_links_to_idx on public.content_links (to_id);

create table public.content_muscles (
  item_id uuid not null references public.content_items (id) on delete cascade,
  muscle_id text not null references public.muscles (id),
  is_primary boolean not null default false,
  primary key (item_id, muscle_id)
);
create index content_muscles_muscle_idx on public.content_muscles (muscle_id);

-- Policies call this. Security definer, so it reads user_roles without recursing into its RLS.
create function public.has_role(wanted public.app_role)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.user_roles where user_id = auth.uid() and role = wanted);
$$;

create function public.submit_content(item uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  i public.content_items;
  c public.categories;
begin
  select * into i from public.content_items where id = item for update;
  if not found or i.author_id is distinct from uid or not public.has_role('coach') then
    raise exception 'not_author' using errcode = '42501';
  end if;
  if i.status not in ('draft', 'needs_changes') then
    raise exception 'not_editable' using errcode = '22023';
  end if;
  select c2.* into c from public.categories c2 join public.disciplines d on d.category_id = c2.id where d.id = i.discipline_id;
  if i.video_id is null or btrim(i.mistakes) = '' or btrim(i.safety) = ''
    or (select count(*) from public.content_steps where item_id = item) < 3
    or (c.uses_supports and cardinality(i.supports) = 0)
    or (c.uses_muscles and not exists (select 1 from public.content_muscles where item_id = item)) then
    raise exception 'incomplete' using errcode = '22023';
  end if;
  update public.content_items set status = 'in_review' where id = item;
end;
$$;

create function public.review_content(item uuid, approve boolean, note text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  i public.content_items;
  clean text := nullif(btrim(coalesce(note, '')), '');
begin
  if not (public.has_role('reviewer') or public.is_admin()) then
    raise exception 'not_reviewer' using errcode = '42501';
  end if;
  select * into i from public.content_items where id = item for update;
  if not found then
    raise exception 'not_found' using errcode = '22023';
  end if;
  if i.author_id = uid then
    raise exception 'own_item' using errcode = '42501';
  end if;
  if i.status <> 'in_review' then
    raise exception 'not_in_review' using errcode = '22023';
  end if;
  if approve is null or (not approve and clean is null) then
    raise exception 'note_required' using errcode = '22023';
  end if;
  update public.content_items set
    status = case when approve then 'published'::public.content_status else 'needs_changes' end,
    review_note = case when approve then null else left(clean, 1000) end,
    reviewed_by = uid,
    published_at = case when approve then now() else published_at end
  where id = item;
  insert into public.audit_log (actor_id, action, target_id, details)
  values (uid, case when approve then 'content_published' else 'content_sent_back' end, item, jsonb_build_object('note', clean));
end;
$$;

-- Privileges: everyone reads, nobody writes directly.
revoke all on public.disciplines, public.muscles, public.content_items, public.content_steps, public.content_links, public.content_muscles from anon, authenticated;
grant all on public.disciplines, public.muscles, public.content_items, public.content_steps, public.content_links, public.content_muscles to service_role;
grant select on public.disciplines, public.muscles, public.content_items, public.content_steps, public.content_links, public.content_muscles to anon, authenticated;
revoke execute on function public.has_role(public.app_role), public.submit_content(uuid), public.review_content(uuid, boolean, text) from public, anon, authenticated;
grant execute on function public.has_role(public.app_role), public.submit_content(uuid), public.review_content(uuid, boolean, text) to authenticated;

alter table public.disciplines enable row level security;
alter table public.muscles enable row level security;
alter table public.content_items enable row level security;
alter table public.content_steps enable row level security;
alter table public.content_links enable row level security;
alter table public.content_muscles enable row level security;

create policy disciplines_select_all on public.disciplines for select to anon, authenticated using (true);
create policy muscles_select_all on public.muscles for select to anon, authenticated using (true);
create policy content_items_select_published on public.content_items for select to anon, authenticated using (status = 'published');
create policy content_items_select_author on public.content_items for select to authenticated using (author_id = (select auth.uid()));
create policy content_items_select_reviewer on public.content_items for select to authenticated
  using (status <> 'draft' and (select public.has_role('reviewer')));
create policy content_items_select_admin on public.content_items for select to authenticated using ((select public.is_admin()));
-- Child rows follow their item: the subquery runs under the content_items policies above.
create policy content_steps_select_visible on public.content_steps for select to anon, authenticated
  using (exists (select 1 from public.content_items i where i.id = item_id));
create policy content_muscles_select_visible on public.content_muscles for select to anon, authenticated
  using (exists (select 1 from public.content_items i where i.id = item_id));
create policy content_links_select_visible on public.content_links for select to anon, authenticated
  using (exists (select 1 from public.content_items i where i.id = from_id) and exists (select 1 from public.content_items i where i.id = to_id));
