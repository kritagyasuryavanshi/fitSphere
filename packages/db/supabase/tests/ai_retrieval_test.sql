-- M5-01: retrieval for the AI guide. Ranked full-text search over published, non-sample content only; it returns
-- item ids, so every answer can cite what it used.
begin;
select plan(8);

create temp table d as select id from public.disciplines order by sort limit 1;
insert into public.content_items (id, discipline_id, kind, slug, title, summary, mistakes, safety, status, is_sample, published_at) values
  ('c1000000-0000-0000-0000-000000000001', (select id from d), 'skill', 'ai-guard-up', 'Keeping your guard up',
    'Hands high by the cheekbones, elbows in, so you can block and counter when tired.', 'Dropping the rear hand after a jab.', 'Stop if your shoulder hurts.', 'published', false, now()),
  ('c1000000-0000-0000-0000-000000000002', (select id from d), 'drill', 'ai-guard-sample', 'Sample guard drill',
    'A sample guard drill for tired arms.', '', '', 'published', true, now()),
  ('c1000000-0000-0000-0000-000000000003', (select id from d), 'drill', 'ai-guard-draft', 'Draft guard drill', 'Guard work when tired.', '', '', 'draft', false, null),
  ('c1000000-0000-0000-0000-000000000004', (select id from d), 'drill', 'ai-guard-review', 'Guard drill in review', 'Guard work when tired.', '', '', 'in_review', false, null),
  ('c1000000-0000-0000-0000-000000000005', (select id from d), 'drill', 'ai-guard-changes', 'Guard drill needing changes', 'Guard work when tired.', '', '', 'needs_changes', false, null),
  ('c1000000-0000-0000-0000-000000000006', (select id from d), 'skill', 'ai-footwork', 'Footwork: the step drag', 'Move your lead foot first, then drag the rear foot.', '', '', 'published', false, now());

-- The server reads it for the answer service; the public and signed-in people cannot call it.
set local role authenticated;
select throws_ok($$ select * from public.retrieve_for_ai('guard') $$, '42501', null, 'a signed-in person cannot call it');
reset role;
set local role service_role;

select is((select item_id from public.retrieve_for_ai('How do I keep my guard up when I am tired?') limit 1), 'c1000000-0000-0000-0000-000000000001'::uuid,
  'a natural question finds the lesson that answers it, first');
select is((select count(*)::int from public.retrieve_for_ai('guard tired') where item_id in
  ('c1000000-0000-0000-0000-000000000003', 'c1000000-0000-0000-0000-000000000004', 'c1000000-0000-0000-0000-000000000005')), 0,
  'draft, in-review and needs-changes items are never returned');
select is((select count(*)::int from public.retrieve_for_ai('sample guard drill') where item_id = 'c1000000-0000-0000-0000-000000000002'), 0,
  'sample items are never returned, even by name');
select ok((select summary like 'Hands high%' and mistakes like 'Dropping%' and safety like 'Stop%' from public.retrieve_for_ai('guard') where item_id = 'c1000000-0000-0000-0000-000000000001'),
  'each result carries the text the answer can quote, with its safety note');
select is((select count(*)::int from public.retrieve_for_ai('guard footwork', 1)), 1, 'at most the number asked for');
select is((select count(*)::int from public.retrieve_for_ai('zzqx nothing matches')), 0, 'no match returns nothing');
select is((select count(*)::int from public.retrieve_for_ai('   ')), 0, 'an empty question returns nothing');

select * from finish();
rollback;
