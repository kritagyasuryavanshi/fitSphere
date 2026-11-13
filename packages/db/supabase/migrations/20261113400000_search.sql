-- M2-05: library search with Postgres full-text (design doc open question 1: no embeddings in v1).
-- Title weighs most, then summary, then mistakes and safety.
alter table public.content_items add column search tsvector generated always as (
  setweight(to_tsvector('english', title), 'A') ||
  setweight(to_tsvector('english', summary), 'B') ||
  setweight(to_tsvector('english', mistakes || ' ' || safety), 'C')
) stored;
create index content_items_search_idx on public.content_items using gin (search);

-- Security invoker: RLS still applies, and the status check keeps drafts out even for their authors.
create function public.search_content(q text)
returns table (slug text, title text, kind public.content_kind, level public.content_level, duration_min smallint,
  equipment text[], supports text[], is_sample boolean, author_id uuid, category_id text, rank real)
language sql
stable
set search_path = ''
as $$
  select i.slug, i.title, i.kind, i.level, i.duration_min, i.equipment, i.supports, i.is_sample, i.author_id, d.category_id,
    ts_rank(i.search, query, 1) as rank
  from public.content_items i
  join public.disciplines d on d.id = i.discipline_id
  cross join websearch_to_tsquery('english', left(coalesce(q, ''), 200)) query
  where i.status = 'published'
    and i.search @@ query
  -- An item named for the query comes first: title matches, then the shortest title, then rank.
  order by to_tsvector('english', i.title) @@ query desc, char_length(i.title), rank desc, i.title
  limit 50;
$$;
revoke execute on function public.search_content(text) from public;
grant execute on function public.search_content(text) to anon, authenticated;
