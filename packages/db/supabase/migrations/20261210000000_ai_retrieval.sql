-- M5-01: retrieval for the AI guide (PROJECT.md: Postgres full-text search in v1, no embeddings). It searches only
-- published, non-sample content, so an answer can never cite a draft or a placeholder, and it returns each item's id
-- and the text an answer may quote, with the safety note.

-- A natural question ("how do I keep my guard up when tired?") matches content with any of its words, ranked by how
-- well each item covers them; the library's own search (search_content) needs all words, which suits a search box.
create function public.retrieve_for_ai(question text, k int default 5)
returns table (item_id uuid, slug text, title text, kind public.content_kind, category_id text, summary text, mistakes text, safety text, rank real)
language sql
stable
set search_path = ''
as $$
  with words as (
    -- Letters and digits only, so nothing in the question is read as search syntax; at most 30 words.
    select array_to_string((array(select w from regexp_split_to_table(lower(left(coalesce(question, ''), 500)), '[^a-z0-9]+') w where char_length(w) > 1 limit 30)), ' or ') as q
  ),
  query as (
    select websearch_to_tsquery('english', q) as tq from words where q <> ''
  )
  select i.id, i.slug, i.title, i.kind, d.category_id, i.summary, i.mistakes, i.safety, ts_rank_cd(i.search, query.tq) as rank
  from public.content_items i
  join public.disciplines d on d.id = i.discipline_id
  cross join query
  where i.status = 'published' and not i.is_sample and i.search @@ query.tq
  order by rank desc, char_length(i.title), i.id
  limit greatest(1, least(coalesce(k, 5), 10));
$$;
revoke all on function public.retrieve_for_ai(text, int) from public, anon, authenticated;
grant execute on function public.retrieve_for_ai(text, int) to service_role;
