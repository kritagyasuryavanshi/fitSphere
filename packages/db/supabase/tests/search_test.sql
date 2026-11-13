-- M2-05: library search with Postgres full-text.
begin;
select plan(5);

set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select is((select slug from public.search_content('jab') limit 1), 'jab', 'searching jab returns the jab skill first');
select ok((select count(*) from public.search_content('jab') where kind = 'drill') >= 1, 'jab also finds drills');
select is_empty($$ select 1 from public.search_content('   ') $$, 'an empty query returns nothing');
select ok((select count(*) from public.search_content('benching')) >= 1, 'English stemming matches bench');

reset role;
update public.content_items set status = 'draft' where slug = 'jab';
set local role anon;
select is_empty($$ select 1 from public.search_content('jab') where slug = 'jab' $$, 'unpublished items never appear');

select * from finish();
rollback;
