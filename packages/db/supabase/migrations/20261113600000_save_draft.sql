-- M2-08: the coach editor's only write path. It creates or updates the caller's own draft,
-- with its steps, muscles and learn-first links, in one transaction. Submit stays in submit_content.
create function public.save_content_draft(
  item uuid, discipline uuid, kind public.content_kind, title text, summary text, level public.content_level,
  duration_min int, equipment text[], supports text[], video_id text, mistakes text, safety text,
  steps text[], muscles text[], prerequisites uuid[])
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  clean_title text := btrim(coalesce(title, ''));
  clean_steps text[] := array(select btrim(s) from unnest(coalesce(steps, '{}')) with ordinality u(s, n) where btrim(s) <> '' order by n);
  base text;
  existing public.content_items;
begin
  if not public.has_role('coach') then
    raise exception 'not_coach' using errcode = '42501';
  end if;
  if clean_title = '' then
    raise exception 'title_required' using errcode = '22023';
  end if;
  if not exists (select 1 from public.disciplines where id = discipline) then
    raise exception 'bad_discipline' using errcode = '22023';
  end if;
  if coalesce(cardinality(equipment), 0) > 20 or coalesce(cardinality(supports), 0) > 20
    or exists (select 1 from unnest(coalesce(equipment, '{}') || coalesce(supports, '{}')) t where t is null or t !~ '^[a-z0-9_]{1,40}$') then
    raise exception 'bad_tag' using errcode = '22023';
  end if;
  if exists (select 1 from unnest(coalesce(muscles, '{}')) m where m is null or m not in (select id from public.muscles)) then
    raise exception 'bad_muscle' using errcode = '22023';
  end if;
  if cardinality(clean_steps) > 30 or exists (select 1 from unnest(clean_steps) s where char_length(s) > 500) then
    raise exception 'steps_too_long' using errcode = '22023';
  end if;
  if exists (select 1 from unnest(coalesce(prerequisites, '{}')) p where p is null or p = item
             or p not in (select id from public.content_items where status = 'published')) then
    raise exception 'bad_link' using errcode = '22023';
  end if;

  if item is null then
    base := coalesce(nullif(left(btrim(regexp_replace(lower(clean_title), '[^a-z0-9]+', '-', 'g'), '-'), 60), ''), 'lesson');
    if exists (select 1 from public.content_items where slug = base) then
      base := base || '-' || substr(md5(gen_random_uuid()::text), 1, 6);
    end if;
    begin
      insert into public.content_items (discipline_id, author_id, kind, slug, title)
      values (discipline, uid, save_content_draft.kind, base, clean_title) returning id into item;
    exception when unique_violation then
      -- Two coaches saved the same new title at once; the second gets a suffix.
      insert into public.content_items (discipline_id, author_id, kind, slug, title)
      values (discipline, uid, save_content_draft.kind, left(base, 60) || '-' || substr(md5(gen_random_uuid()::text), 1, 6), clean_title) returning id into item;
    end;
  else
    select * into existing from public.content_items where id = item for update;
    if not found or existing.author_id is distinct from uid then
      raise exception 'not_author' using errcode = '42501';
    end if;
    if existing.status not in ('draft', 'needs_changes') then
      raise exception 'not_editable' using errcode = '22023';
    end if;
  end if;

  update public.content_items set
    discipline_id = discipline, kind = save_content_draft.kind, title = clean_title,
    summary = left(btrim(coalesce(save_content_draft.summary, '')), 500), level = save_content_draft.level,
    duration_min = save_content_draft.duration_min, equipment = coalesce(save_content_draft.equipment, '{}'),
    supports = coalesce(save_content_draft.supports, '{}'), video_id = nullif(btrim(coalesce(save_content_draft.video_id, '')), ''),
    mistakes = left(btrim(coalesce(save_content_draft.mistakes, '')), 1000), safety = left(btrim(coalesce(save_content_draft.safety, '')), 1000)
  where id = item;

  delete from public.content_steps where item_id = item;
  insert into public.content_steps (item_id, position, body) select item, n, s from unnest(clean_steps) with ordinality u(s, n);
  delete from public.content_muscles where item_id = item;
  insert into public.content_muscles (item_id, muscle_id, is_primary)
    select item, m, n = 1 from unnest(coalesce(muscles, '{}')) with ordinality u(m, n) on conflict do nothing;
  delete from public.content_links l where l.from_id = item and l.kind = 'prerequisite';
  insert into public.content_links (from_id, to_id, kind, sort)
    select item, p, 'prerequisite', n from unnest(coalesce(prerequisites, '{}')) with ordinality u(p, n) on conflict do nothing;
  return item;
end;
$$;
revoke execute on function public.save_content_draft(uuid, uuid, public.content_kind, text, text, public.content_level, int, text[], text[], text, text, text, text[], text[], uuid[]) from public, anon;
grant execute on function public.save_content_draft(uuid, uuid, public.content_kind, text, text, public.content_level, int, text[], text[], text, text, text, text[], text[], uuid[]) to authenticated;
