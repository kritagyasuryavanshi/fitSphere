-- M3-01: programs, versions, sessions and typed items.
begin;
select plan(20);

insert into auth.users (id, email, email_confirmed_at) values
  ('c0000000-0000-0000-0000-00000000000c', 'c@t.test', now()),
  ('d0000000-0000-0000-0000-00000000000d', 'd@t.test', now()),
  ('a0000000-0000-0000-0000-00000000000a', 'a@t.test', now());
insert into public.user_roles (user_id, role) values
  ('c0000000-0000-0000-0000-00000000000c', 'coach'), ('d0000000-0000-0000-0000-00000000000d', 'coach');
insert into public.content_items (discipline_id, kind, slug, title, status) values
  ((select id from public.disciplines where category_id = 'boxing' and slug = 'defence'), 'skill', 'secret-draft', 'Secret', 'draft');

create temp table ids (name text primary key, id uuid);
grant all on ids to authenticated;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"c0000000-0000-0000-0000-00000000000c","role":"authenticated"}', true);

insert into ids select 'p', public.create_program('Ring Engine', 'boxing');
select is((select coach_id::text from public.programs where id = (select id from ids)), 'c0000000-0000-0000-0000-00000000000c', 'the coach owns the new program');
select is((select count(*)::int from public.program_versions where program_id = (select id from ids) and published_at is null), 1, 'it starts with one draft');

-- One boxing session (rounds, time) and one S&C session (sets x reps x load).
select lives_ok(format($$ select public.save_program_draft(%L, 'Ring Engine', 'Four weeks for boxers.', 4, %L) $$, (select id from ids),
  jsonb_build_array(
    jsonb_build_object('week', 1, 'day', 1, 'title', 'Jab day', 'items', jsonb_build_array(
      jsonb_build_object('item', (select id from public.content_items where slug = 'jab'), 'type', 'rounds', 'rounds', 3, 'work_s', 120, 'rest_s', 60, 'cue', 'Snap it back.'),
      jsonb_build_object('item', (select id from public.content_items where slug = 'skipping'), 'type', 'time', 'seconds', 600))),
    jsonb_build_object('week', 1, 'day', 3, 'title', 'Power', 'items', jsonb_build_array(
      jsonb_build_object('item', (select id from public.content_items where slug = 'kettlebell-swing'), 'type', 'sets', 'sets', 3, 'reps', 15, 'load_kg', 16)))
  )), 'the coach saves two sessions');
select is((select count(*)::int from public.session_items i join public.program_sessions s on s.id = i.session_id join public.program_versions v on v.id = s.version_id where v.program_id = (select id from ids)), 3, 'three items are stored');
select is((select prescription->>'rounds' from public.session_items where cue = 'Snap it back.'), '3', 'the prescription keeps its numbers');

select throws_ok(format($$ select public.save_program_draft(%L, 'X', '', 4, %L) $$, (select id from ids),
  jsonb_build_array(jsonb_build_object('week', 1, 'day', 1, 'title', 'Bad', 'items', jsonb_build_array(
    jsonb_build_object('item', (select id from public.content_items where slug = 'jab'), 'type', 'sets', 'reps', 10))))),
  '22023', 'bad_prescription', 'sets need sets and reps');
select throws_ok(format($$ select public.save_program_draft(%L, 'X', '', 4, %L) $$, (select id from ids),
  jsonb_build_array(jsonb_build_object('week', 1, 'day', 1, 'title', 'Bad', 'items', jsonb_build_array(
    jsonb_build_object('item', (select id from public.content_items where slug = 'secret-draft'), 'type', 'time', 'seconds', 60))))),
  '22023', 'item_not_published', 'only published library items can be added');
select throws_ok(format($$ select public.save_program_draft(%L, 'X', '', 4, %L) $$, (select id from ids),
  jsonb_build_array(jsonb_build_object('week', 5, 'day', 1, 'title', 'Late', 'items', '[]'::jsonb))),
  '22023', 'bad_day', 'a session must fall inside the program weeks');

select throws_ok($$ select public.create_program('  ', 'boxing') $$, '22023', 'title_required', 'a program needs a title');
select throws_ok(format($$ select public.save_program_draft(%L, ' ', '', 4, '[]') $$, (select id from ids)), '22023', 'title_required', 'saving keeps a title');
select throws_ok(format($$ select public.save_program_draft(%L, 'X', '', 4, %L) $$, (select id from ids),
  jsonb_build_array(jsonb_build_object('week', 1, 'day', 1, 'title', 'Bad', 'items', jsonb_build_array(
    jsonb_build_object('item', 'zzzzzzzz-zzzz-zzzz-zzzz-zzzzzzzzzzzz', 'type', 'time', 'seconds', 60))))),
  '22023', 'item_not_published', 'a malformed item id is refused cleanly');

-- Publishing freezes the draft and opens a new one.
select lives_ok(format($$ select public.publish_program(%L) $$, (select id from ids)), 'the coach publishes');
select is((select count(*)::int from public.program_versions where program_id = (select id from ids) and published_at is not null), 1, 'one published version');
select is((select effective_from from public.program_versions where program_id = (select id from ids) and version = 1), (now() at time zone 'Asia/Kolkata')::date, 'the first version is live today');
select is((select count(*)::int from public.session_items i join public.program_sessions s on s.id = i.session_id join public.program_versions v on v.id = s.version_id where v.program_id = (select id from ids) and v.published_at is null), 3, 'the new draft starts as a copy');
select lives_ok(format($$ select public.publish_program(%L) $$, (select id from ids)), 'the coach publishes again');
select is((select effective_from from public.program_versions where program_id = (select id from ids) and version = 2), (now() at time zone 'Asia/Kolkata')::date + 1, 'a later version starts tomorrow');

-- Another coach cannot edit or read the draft; the public reads published versions only.
select set_config('request.jwt.claims', '{"sub":"d0000000-0000-0000-0000-00000000000d","role":"authenticated"}', true);
select throws_ok(format($$ select public.save_program_draft(%L, 'Mine', '', 4, '[]') $$, (select id from ids)), '42501', 'not_owner', 'only the owning coach edits a program');
select is((select count(*)::int from public.program_versions where program_id = (select id from ids) and published_at is null), 0, 'another coach cannot see the draft');
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select is((select count(*)::int from public.program_versions), 2, 'the public sees the published versions');

select * from finish();
rollback;
