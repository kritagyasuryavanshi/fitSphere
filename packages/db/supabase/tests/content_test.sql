-- M2-01: content schema, read rules and the draft -> in review -> published workflow.
begin;
select plan(36);

-- Start from an empty library; the sample seed (M2-02) is rolled back with the test.
delete from public.content_items;

insert into auth.users (id, email, email_confirmed_at) values
  ('c0000000-0000-0000-0000-00000000000c', 'c@t.test', now()),
  ('d0000000-0000-0000-0000-00000000000d', 'd@t.test', now()),
  ('e0000000-0000-0000-0000-00000000000e', 'r@t.test', now()),
  ('f0000000-0000-0000-0000-00000000000f', 'cr@t.test', now()),
  ('a0000000-0000-0000-0000-00000000000a', 'a@t.test', now());
insert into public.user_roles (user_id, role) values
  ('c0000000-0000-0000-0000-00000000000c', 'coach'),
  ('d0000000-0000-0000-0000-00000000000d', 'coach'),
  ('e0000000-0000-0000-0000-00000000000e', 'reviewer'),
  ('f0000000-0000-0000-0000-00000000000f', 'coach'),
  ('f0000000-0000-0000-0000-00000000000f', 'reviewer');

select is((select array_agg(id order by sort) from public.categories where is_live), array['boxing', 'sc', 'gym'], 'three live categories');

-- Items by coach C: a complete boxing draft, a bare draft, an S&C and a gym draft without their tags, one published.
insert into public.content_items (id, discipline_id, author_id, kind, slug, title, video_id, mistakes, safety, status) values
  ('10000000-0000-0000-0000-000000000001', (select id from public.disciplines where category_id = 'boxing' and slug = 'technical'), 'c0000000-0000-0000-0000-00000000000c', 'skill', 'the-jab', 'The Jab', 'dQw4w9WgXcQ', 'Dropping the hand.', 'Warm up first.', 'draft'),
  ('10000000-0000-0000-0000-000000000002', (select id from public.disciplines where category_id = 'boxing' and slug = 'technical'), 'c0000000-0000-0000-0000-00000000000c', 'skill', 'bare', 'Bare', null, '', '', 'draft'),
  ('10000000-0000-0000-0000-000000000003', (select id from public.disciplines where category_id = 'sc' and slug = 'power'), 'c0000000-0000-0000-0000-00000000000c', 'exercise', 'kb-swing', 'Kettlebell swing', 'dQw4w9WgXcQ', 'Squatting.', 'Start light.', 'draft'),
  ('10000000-0000-0000-0000-000000000004', (select id from public.disciplines where category_id = 'gym' and slug = 'chest'), 'c0000000-0000-0000-0000-00000000000c', 'exercise', 'bench', 'Bench press', 'dQw4w9WgXcQ', 'Bouncing.', 'Use a spotter.', 'draft'),
  ('10000000-0000-0000-0000-000000000005', (select id from public.disciplines where category_id = 'boxing' and slug = 'technical'), 'c0000000-0000-0000-0000-00000000000c', 'skill', 'stance', 'Stance', 'dQw4w9WgXcQ', 'Square feet.', 'Warm up.', 'published');
insert into public.content_steps (item_id, position, body)
  select i, p, 'Step ' || p from unnest(array['10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000005']::uuid[]) i, generate_series(1, 3) p;
-- The published stance links to the draft jab; the public must not see that link.
insert into public.content_links (from_id, to_id, kind) values
  ('10000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000001', 'related');

-- Anonymous visitors see published items only, with their steps.
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select is((select array_agg(slug) from public.content_items), array['stance'], 'anon reads only the published item');
select is_empty($$ select 1 from public.content_items where slug = 'the-jab' $$, 'a draft read returns nothing');
select is((select count(*)::int from public.content_steps), 3, 'anon sees only the steps of published items');
select is_empty($$ select 1 from public.content_links $$, 'a link to a draft stays hidden');

-- The author sees their own drafts. Another coach does not.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"c0000000-0000-0000-0000-00000000000c","role":"authenticated"}', true);
select is((select count(*)::int from public.content_items), 5, 'the author sees all of their items');
select throws_ok($$ update public.content_items set status = 'published' where slug = 'the-jab' $$, '42501', null, 'an author cannot set status to published');
select throws_ok($$ insert into public.content_steps (item_id, position, body) values ('10000000-0000-0000-0000-000000000002', 1, 'x') $$, '42501', null, 'nobody writes content rows directly');

select set_config('request.jwt.claims', '{"sub":"d0000000-0000-0000-0000-00000000000d","role":"authenticated"}', true);
select is((select array_agg(slug) from public.content_items), array['stance'], 'another coach sees only published items');
select throws_ok($$ select public.submit_content('10000000-0000-0000-0000-000000000001') $$, '42501', 'not_author', 'only the author submits');

-- Submit checks the item is complete.
select set_config('request.jwt.claims', '{"sub":"c0000000-0000-0000-0000-00000000000c","role":"authenticated"}', true);
select throws_ok($$ select public.submit_content('10000000-0000-0000-0000-000000000002') $$, '22023', 'incomplete', 'no video, steps, mistakes or safety: refused');
select throws_ok($$ select public.submit_content('10000000-0000-0000-0000-000000000003') $$, '22023', 'incomplete', 'an S&C item needs supports tags');
select throws_ok($$ select public.submit_content('10000000-0000-0000-0000-000000000004') $$, '22023', 'incomplete', 'a gym item needs a muscle link');
select lives_ok($$ select public.submit_content('10000000-0000-0000-0000-000000000001') $$, 'a complete boxing item is submitted');
select is((select status::text from public.content_items where slug = 'the-jab'), 'in_review', 'it is now in review');
select throws_ok($$ select public.submit_content('10000000-0000-0000-0000-000000000001') $$, '22023', 'not_editable', 'an item in review cannot be submitted again');

reset role;
update public.content_items set supports = array['punching_power'] where slug = 'kb-swing';
insert into public.content_muscles (item_id, muscle_id, is_primary) values ('10000000-0000-0000-0000-000000000004', 'chest', true);
set local role authenticated;
select lives_ok($$ select public.submit_content('10000000-0000-0000-0000-000000000003') $$, 'an S&C item with supports tags is submitted');
select lives_ok($$ select public.submit_content('10000000-0000-0000-0000-000000000004') $$, 'a gym item with a muscle link is submitted');
select throws_ok($$ select public.review_content('10000000-0000-0000-0000-000000000001', true, '') $$, '42501', 'not_reviewer', 'a coach cannot review');

-- Reviewer R sends one back, then approves another.
select set_config('request.jwt.claims', '{"sub":"e0000000-0000-0000-0000-00000000000e","role":"authenticated"}', true);
select is((select array_agg(slug order by slug) from public.content_items), array['bench', 'kb-swing', 'stance', 'the-jab'], 'a reviewer sees items in review, not drafts');
select throws_ok($$ select public.review_content('10000000-0000-0000-0000-000000000003', false, '  ') $$, '22023', 'note_required', 'sending back needs a note');
select lives_ok($$ select public.review_content('10000000-0000-0000-0000-000000000003', false, 'Show the hinge from the side.') $$, 'R sends the swing back');
select lives_ok($$ select public.review_content('10000000-0000-0000-0000-000000000001', true, '') $$, 'R approves the jab');
select is((select status::text || '|' || reviewed_by::text || '|' || (published_at is not null)::text from public.content_items where slug = 'the-jab'), 'published|e0000000-0000-0000-0000-00000000000e|true', 'the jab is published by R');
select throws_ok($$ select public.review_content('10000000-0000-0000-0000-000000000001', true, '') $$, '22023', 'not_in_review', 'only items in review can be reviewed');

-- The author sees the note on the item that was sent back.
select set_config('request.jwt.claims', '{"sub":"c0000000-0000-0000-0000-00000000000c","role":"authenticated"}', true);
select is((select status::text || '|' || review_note from public.content_items where slug = 'kb-swing'), 'needs_changes|Show the hinge from the side.', 'the author sees the note');

-- A reviewer sees the author name of an item waiting in review; the public does not.
reset role;
update public.profiles set display_name = 'Coach C' where id = 'c0000000-0000-0000-0000-00000000000c';
insert into public.content_items (discipline_id, author_id, kind, slug, title, status) values
  ((select id from public.disciplines where category_id = 'boxing' and slug = 'footwork'), 'd0000000-0000-0000-0000-00000000000d', 'skill', 'waiting', 'Waiting', 'in_review');
update public.profiles set display_name = 'Coach D' where id = 'd0000000-0000-0000-0000-00000000000d';
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"e0000000-0000-0000-0000-00000000000e","role":"authenticated"}', true);
select is((select display_name from public.author_names(array['d0000000-0000-0000-0000-00000000000d']::uuid[])), 'Coach D', 'a reviewer sees who wrote an item in review');
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select is_empty($$ select 1 from public.author_names(array['d0000000-0000-0000-0000-00000000000d']::uuid[]) $$, 'the public does not');

-- A coach who is also a reviewer cannot publish their own item.
reset role;
insert into public.content_items (id, discipline_id, author_id, kind, slug, title, video_id, mistakes, safety, status) values
  ('10000000-0000-0000-0000-000000000006', (select id from public.disciplines where category_id = 'boxing' and slug = 'defence'), 'f0000000-0000-0000-0000-00000000000f', 'skill', 'slip', 'Slip', 'dQw4w9WgXcQ', 'Leaning.', 'Go slow.', 'in_review');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"f0000000-0000-0000-0000-00000000000f","role":"authenticated"}', true);
select throws_ok($$ select public.review_content('10000000-0000-0000-0000-000000000006', true, '') $$, '42501', 'own_item', 'a reviewer cannot publish an item they wrote');

-- Categories are data: a fourth one needs rows only, and its published items are public.
reset role;
insert into public.categories (id, name, sort) values ('tennis', 'Tennis', 9);
insert into public.disciplines (category_id, slug, name) values ('tennis', 'serve', 'Serve');
insert into public.content_items (discipline_id, kind, slug, title, status, is_sample) values
  ((select id from public.disciplines where category_id = 'tennis'), 'skill', 'flat-serve', 'Flat serve', 'published', true);
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select is((select i.title from public.content_items i join public.disciplines d on d.id = i.discipline_id join public.categories c on c.id = d.category_id where c.id = 'tennis'), 'Flat serve', 'a fourth category lists its items');

-- Author names are public only for people with a published item.
reset role;
update public.profiles set display_name = 'Coach C' where id = 'c0000000-0000-0000-0000-00000000000c';
update public.profiles set display_name = 'Coach D' where id = 'd0000000-0000-0000-0000-00000000000d';
set local role anon;
select is((select array_agg(display_name) from public.author_names(array['c0000000-0000-0000-0000-00000000000c', 'd0000000-0000-0000-0000-00000000000d']::uuid[])), array['Coach C'], 'only authors of published items have a public name');
select throws_ok($$ select 1 from public.profiles $$, '42501', null, 'profiles stay private');
select is((select count(*)::int from public.author_names(array['e0000000-0000-0000-0000-00000000000e']::uuid[])), 1, 'the reviewer of a published item has a public name');

-- A deleted author leaves their published items in place.
reset role;
delete from auth.users where id = 'c0000000-0000-0000-0000-00000000000c';
select is((select author_id from public.content_items where slug = 'the-jab'), null, 'deleting the author keeps the item');

-- A bad video id or slug is refused.
select throws_ok($$ update public.content_items set video_id = 'https://youtu.be/x' where slug = 'stance' $$, '23514', null, 'the video is an 11-character YouTube id');
select throws_ok($$ update public.content_items set slug = 'Bad Slug' where slug = 'stance' $$, '23514', null, 'slugs are lowercase words and dashes');

select * from finish();
rollback;
