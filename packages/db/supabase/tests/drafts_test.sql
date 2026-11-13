-- M2-08: coaches save drafts through save_content_draft only.
begin;
select plan(12);

insert into auth.users (id, email, email_confirmed_at) values
  ('c0000000-0000-0000-0000-00000000000c', 'c@t.test', now()),
  ('d0000000-0000-0000-0000-00000000000d', 'd@t.test', now()),
  ('a0000000-0000-0000-0000-00000000000a', 'a@t.test', now());
insert into public.user_roles (user_id, role) values
  ('c0000000-0000-0000-0000-00000000000c', 'coach'), ('d0000000-0000-0000-0000-00000000000d', 'coach');

create temp table ids (name text primary key, id uuid);
grant all on ids to authenticated;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"c0000000-0000-0000-0000-00000000000c","role":"authenticated"}', true);

insert into ids select 'jab2', public.save_content_draft(null, (select id from public.disciplines where category_id = 'boxing' and slug = 'combinations'),
  'skill', 'The Jab', 'Two jabs.', 'beginner', 8, array[]::text[], array[]::text[], 'dQw4w9WgXcQ', 'Short first jab.', 'Warm up.',
  array['Stance.', 'Jab.', '  ', 'Jab again.'], array[]::text[], array[(select id from public.content_items where slug = 'jab')]);
select is((select status::text || '|' || author_id::text from public.content_items where id = (select id from ids where name = 'jab2')), 'draft|c0000000-0000-0000-0000-00000000000c', 'a new draft belongs to the coach');
select isnt((select slug from public.content_items where id = (select id from ids where name = 'jab2')), 'jab', 'a taken slug gets a suffix');
select is((select count(*)::int from public.content_steps where item_id = (select id from ids where name = 'jab2')), 3, 'blank steps are dropped');
select is((select count(*)::int from public.content_links where from_id = (select id from ids where name = 'jab2') and kind = 'prerequisite'), 1, 'learn-first links are stored');

-- Saving again replaces the steps.
select lives_ok(format($$ select public.save_content_draft(%L, (select id from public.disciplines where category_id = 'boxing' and slug = 'combinations'),
  'skill', 'The Double Jab', '', 'beginner', null, '{}', '{}', null, '', '', array['One.'], '{}', '{}') $$, (select id from ids where name = 'jab2')), 'the author edits the draft');
select is((select count(*)::int from public.content_steps where item_id = (select id from ids where name = 'jab2')), 1, 'steps are replaced');
select is((select title from public.content_items where id = (select id from ids where name = 'jab2')), 'The Double Jab', 'the title is updated');

select throws_ok($$ select public.save_content_draft(null, (select id from public.disciplines where category_id = 'boxing' and slug = 'defence'), 'skill', '', '', 'beginner', null, '{}', '{}', null, '', '', '{}', '{}', '{}') $$,
  '22023', 'title_required', 'a title is needed');
select throws_ok($$ select public.save_content_draft(null, (select id from public.disciplines where category_id = 'gym' and slug = 'chest'), 'exercise', 'Fly', '', 'beginner', null, '{}', '{}', null, '', '', '{}', array['not_a_muscle'], '{}') $$,
  '22023', 'bad_muscle', 'unknown muscles are refused');

select set_config('request.jwt.claims', '{"sub":"d0000000-0000-0000-0000-00000000000d","role":"authenticated"}', true);
select throws_ok(format($$ select public.save_content_draft(%L, (select id from public.disciplines where category_id = 'boxing' and slug = 'defence'), 'skill', 'Mine', '', 'beginner', null, '{}', '{}', null, '', '', '{}', '{}', '{}') $$, (select id from ids where name = 'jab2')),
  '42501', 'not_author', 'another coach cannot edit it');
select throws_ok(format($$ select public.save_content_draft(%L, (select id from public.disciplines where category_id = 'boxing' and slug = 'defence'), 'skill', 'Mine', '', 'beginner', null, '{}', '{}', null, '', '', '{}', '{}', '{}') $$, (select id from public.content_items where slug = 'jab')),
  '42501', 'not_author', 'nobody edits a sample through the editor');

select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select throws_ok($$ select public.save_content_draft(null, (select id from public.disciplines where category_id = 'boxing' and slug = 'defence'), 'skill', 'Hi', '', 'beginner', null, '{}', '{}', null, '', '', '{}', '{}', '{}') $$,
  '42501', 'not_coach', 'an athlete cannot write drafts');

select * from finish();
rollback;
