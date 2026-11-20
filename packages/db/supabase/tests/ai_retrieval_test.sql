-- M5-01: retrieval for the AI guide. Ranked full-text search over published, non-sample content in live categories;
-- it returns item ids, so every answer can cite what it used, and nothing for a question the library does not cover.
begin;
select plan(13);

create temp table d as select di.id from public.disciplines di join public.categories c on c.id = di.category_id where c.is_live order by di.sort limit 1;
create temp table dark as select di.id from public.disciplines di join public.categories c on c.id = di.category_id where not c.is_live limit 1;
insert into public.content_items (id, discipline_id, kind, slug, title, summary, mistakes, safety, dose, status, is_sample, published_at) values
  ('c1000000-0000-0000-0000-000000000001', (select id from d), 'skill', 'ai-guard-up', 'Keeping your guard up',
    'Hands high by the cheekbones, elbows in, so you can block and counter when tired.', 'Dropping the rear hand after a jab.', 'Stop if your shoulder hurts.',
    '[{"goal": "technique", "sets": 3, "reps": "10 each side"}]', 'published', false, now()),
  ('c1000000-0000-0000-0000-000000000002', (select id from d), 'drill', 'ai-guard-sample', 'Sample guard drill',
    'A sample guard drill for tired arms.', '', '', '[]', 'published', true, now()),
  ('c1000000-0000-0000-0000-000000000003', (select id from d), 'drill', 'ai-guard-draft', 'Draft guard drill', 'Guard work when tired.', '', '', '[]', 'draft', false, null),
  ('c1000000-0000-0000-0000-000000000004', (select id from d), 'drill', 'ai-guard-review', 'Guard drill in review', 'Guard work when tired.', '', '', '[]', 'in_review', false, null),
  ('c1000000-0000-0000-0000-000000000005', (select id from d), 'drill', 'ai-guard-changes', 'Guard drill needing changes', 'Guard work when tired.', '', '', '[]', 'needs_changes', false, null),
  ('c1000000-0000-0000-0000-000000000006', (select id from d), 'skill', 'ai-footwork', 'Footwork: the step drag', 'Keep your guard while you step: lead foot first, then drag the rear foot.', '', '', '[]', 'published', false, now());
insert into public.content_steps (item_id, position, body) values
  ('c1000000-0000-0000-0000-000000000001', 1, 'Raise both fists to your cheekbones.'),
  ('c1000000-0000-0000-0000-000000000001', 2, 'Tuck your elbows to your ribs.');
-- A published guard lesson in a category that is not live yet (if one exists in the seed).
insert into public.content_items (id, discipline_id, kind, slug, title, summary, status, is_sample, published_at)
  select 'c1000000-0000-0000-0000-000000000007', id, 'skill', 'ai-guard-dark', 'Guard in a sport not live yet', 'Guard work when tired.', 'published', false, now() from dark;

-- The server reads it for the answer service; the public and signed-in people cannot call it.
set local role anon;
select throws_ok($$ select * from public.retrieve_for_ai('guard') $$, '42501', null, 'a visitor cannot call it');
reset role;
set local role authenticated;
select throws_ok($$ select * from public.retrieve_for_ai('guard') $$, '42501', null, 'nor a signed-in person');
reset role;
set local role service_role;

select is((select (array_agg(item_id order by rank desc))[1] from public.retrieve_for_ai('How do I keep my guard up when I am tired?')), 'c1000000-0000-0000-0000-000000000001'::uuid,
  'a natural question finds the lesson that answers it, first');
select is((select count(*)::int from public.retrieve_for_ai('guard tired') where item_id in
  ('c1000000-0000-0000-0000-000000000003', 'c1000000-0000-0000-0000-000000000004', 'c1000000-0000-0000-0000-000000000005')), 0,
  'draft, in-review and needs-changes items are never returned');
select is((select count(*)::int from public.retrieve_for_ai('sample guard drill') where item_id = 'c1000000-0000-0000-0000-000000000002'), 0,
  'sample items are never returned, even by name');
select is((select count(*)::int from public.retrieve_for_ai('guard tired') where item_id = 'c1000000-0000-0000-0000-000000000007'), 0,
  'nor items in a category that is not live');
select ok((select summary like 'Hands high%' and mistakes like 'Dropping%' and safety like 'Stop%' from public.retrieve_for_ai('guard') where item_id = 'c1000000-0000-0000-0000-000000000001'),
  'each result carries the text the answer can quote, with its safety note');
select is((select steps from public.retrieve_for_ai('guard') where item_id = 'c1000000-0000-0000-0000-000000000001'),
  E'1. Raise both fists to your cheekbones.\n2. Tuck your elbows to your ribs.', 'and its steps, in order');
select is((select dose -> 0 ->> 'reps' from public.retrieve_for_ai('guard') where item_id = 'c1000000-0000-0000-0000-000000000001'), '10 each side',
  'and its sets and reps, so an answer never invents them');
select is((select count(*)::int from public.retrieve_for_ai('guard', 1)), 1, 'at most the number asked for');
select is((select count(*)::int from public.retrieve_for_ai('guard', 0)), 0, 'none when none are asked for');
-- One common word in common is not a match: an off-topic question gets "no library source".
select is((select count(*)::int from public.retrieve_for_ai('How do I keep my car battery charged?')), 0, 'an off-topic question returns nothing');
select is((select count(*)::int from public.retrieve_for_ai('   ')), 0, 'an empty question returns nothing');

select * from finish();
rollback;
