-- M5-01: retrieval for the AI guide (PROJECT.md: Postgres full-text search in v1, no embeddings). It searches only
-- published, non-sample content in live categories, so an answer can never cite a draft, a placeholder or a sport not
-- open yet. It returns each item's id and everything an answer may quote: the summary, the steps, the sets and reps
-- (dose), the common mistakes and the safety note.

-- A natural question matches items that share enough of its words, ranked by how well they cover them. One common word
-- in common ("keep") is not enough: an item must match at least two of the question's words, or every one when there is
-- only one, so an off-topic question returns nothing and the guide says it has no library source. The library's own
-- search (search_content) needs all words, which suits a search box.
create function public.retrieve_for_ai(question text, k int default 5)
returns table (item_id uuid, slug text, title text, kind public.content_kind, category_id text, summary text, steps text, dose jsonb,
  mistakes text, safety text, rank real)
language sql
stable
set search_path = ''
as $$
  with words as (
    -- Letters and digits in any script, so nothing in the question is read as search syntax; at most 30 words.
    select array(select w from regexp_split_to_table(lower(left(coalesce(question, ''), 500)), '[^[:alnum:]]+') w where char_length(w) > 1 limit 30) as w
  ),
  lexemes as (
    -- The question's distinct stemmed words, stop words dropped ("how", "do", "my").
    select coalesce(array(select distinct unnest(tsvector_to_array(to_tsvector('english', array_to_string(w, ' '))))), '{}') as l from words
  ),
  query as (
    select websearch_to_tsquery('english', array_to_string(w, ' or ')) as tq, l from words, lexemes where cardinality(l) > 0
  )
  select i.id, i.slug, i.title, i.kind, d.category_id, i.summary,
    (select string_agg(s.position || '. ' || s.body, E'\n' order by s.position) from public.content_steps s where s.item_id = i.id),
    i.dose, i.mistakes, i.safety, ts_rank_cd(i.search, query.tq) as rank
  from public.content_items i
  join public.disciplines d on d.id = i.discipline_id
  join public.categories c on c.id = d.category_id
  cross join query
  where i.status = 'published' and not i.is_sample and c.is_live and i.search @@ query.tq
    and (select count(*) from unnest(query.l) x where i.search @@ to_tsquery('simple', x)) >= least(2, cardinality(query.l))
  order by rank desc, char_length(i.title), i.id
  -- At most 10; 0 or less asks for none.
  limit least(greatest(coalesce(k, 5), 0), 10);
$$;
revoke all on function public.retrieve_for_ai(text, int) from public, anon, authenticated;
grant execute on function public.retrieve_for_ai(text, int) to service_role;
