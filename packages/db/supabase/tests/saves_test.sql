-- M2-06: saved and completed items, each person's own.
begin;
select plan(9);

insert into auth.users (id, email, email_confirmed_at) values
  ('a0000000-0000-0000-0000-00000000000a', 'a@t.test', now()),
  ('b0000000-0000-0000-0000-00000000000b', 'b@t.test', now());
insert into public.content_items (discipline_id, kind, slug, title, status) values
  ((select id from public.disciplines where slug = 'defence' and category_id = 'boxing'), 'skill', 'hidden-draft', 'Hidden', 'draft');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select lives_ok($$ select public.set_saved((select id from public.content_items where slug = 'jab'), true) $$, 'A saves the jab');
select lives_ok($$ select public.set_saved((select id from public.content_items where slug = 'jab'), true) $$, 'saving twice is fine');
select lives_ok($$ select public.set_completed((select id from public.content_items where slug = 'jab'), true) $$, 'A completes the jab');
select is((select count(*)::int from public.saves) + (select count(*)::int from public.completions), 2, 'one save and one completion');
select throws_ok($$ select public.set_saved((select id from public.content_items where slug = 'hidden-draft'), true) $$, '22023', 'not_found', 'a draft cannot be saved');
select throws_ok($$ insert into public.saves (user_id, item_id) values ('a0000000-0000-0000-0000-00000000000a', (select id from public.content_items where slug = 'cross')) $$, '42501', null, 'no direct writes');

select set_config('request.jwt.claims', '{"sub":"b0000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
select is((select count(*)::int from public.saves) + (select count(*)::int from public.completions), 0, 'B sees none of A''s rows');

select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select public.set_saved((select id from public.content_items where slug = 'jab'), false);
select is((select count(*)::int from public.saves), 0, 'unsaving removes the row');

select is((select jsonb_array_length(public.export_my_data()->'completed')), 1, 'the download lists completions');

select * from finish();
rollback;
