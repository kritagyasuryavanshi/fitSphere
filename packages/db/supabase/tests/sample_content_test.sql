-- M2-02: sample content for all three categories.
begin;
select plan(8);

select ok((select count(*) from public.content_items i join public.disciplines d on d.id = i.discipline_id where d.category_id = 'boxing' and i.kind = 'skill') >= 10, 'at least 10 boxing skills');
select ok((select count(*) from public.content_items i join public.disciplines d on d.id = i.discipline_id where d.category_id = 'sc') >= 8, 'at least 8 S&C exercises');
select ok((select count(*) from public.content_items i join public.disciplines d on d.id = i.discipline_id where d.category_id = 'gym') >= 10, 'at least 10 gym exercises');
select is_empty($$ select 1 from public.content_items where not is_sample $$, 'every seeded item is a sample');
select is_empty($$ select 1 from public.content_items where status <> 'published' $$, 'every sample is published');
select is_empty($$ select 1 from public.content_items i where (select count(*) from public.content_steps s where s.item_id = i.id) < 3 or btrim(mistakes) = '' or btrim(safety) = '' $$,
  'every sample has 3 steps, mistakes and safety');
select is_empty($$ select 1 from public.content_items i join public.disciplines d on d.id = i.discipline_id join public.categories c on c.id = d.category_id
  where (c.uses_supports and cardinality(i.supports) = 0) or (c.uses_muscles and not exists (select 1 from public.content_muscles m where m.item_id = i.id)) $$,
  'S&C samples carry supports tags and gym samples carry muscle links');

-- Running the seed again adds nothing.
create temp table before_counts as select (select count(*) from public.content_items) i, (select count(*) from public.content_steps) s, (select count(*) from public.content_links) l, (select count(*) from public.content_muscles) m;
select public.seed_sample_content();
select is((select (select count(*) from public.content_items) || '|' || (select count(*) from public.content_steps) || '|' || (select count(*) from public.content_links) || '|' || (select count(*) from public.content_muscles)),
  (select i || '|' || s || '|' || l || '|' || m from before_counts), 'the seed is idempotent');

select * from finish();
rollback;
