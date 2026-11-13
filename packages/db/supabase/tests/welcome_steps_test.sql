-- M1-04: sign-up steps 2 to 4 (training basics, per-sport answers, body metrics, two AI consents).
begin;
select plan(30);

-- Test notice versions; the real ones are seeded by the M1-08 migration.
insert into public.consent_notices (purpose, version) values
  ('ai_health_personalisation', 'v1'), ('ai_health_personalisation', 'v2'), ('ai_body_metrics', 'v1');

insert into auth.users (id, email, email_confirmed_at) values
  ('a0000000-0000-0000-0000-00000000000a', 'a@t.test', now()),
  ('b0000000-0000-0000-0000-00000000000b', 'b@t.test', now());

-- As A, before step 1: later steps are refused.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select throws_ok($$ select public.save_training_basics(4, array['gloves'], '', false, 'v1', '{}') $$, '22023', 'step1_required', 'step 2 needs step 1 first');

select lives_ok($$ select public.complete_about_you('Kabir', '1998-06-12', array['boxing', 'gym']) $$, 'A finishes step 1');

-- Step 2 saves basics, the injury-notes consent and the boxing answers in one call.
select lives_ok(
  $$ select public.save_training_basics(4, array['gloves', 'rope'], '  old left knee  ', false, 'v1', '{"boxing": {"experience": "few_classes", "wants": ["technique"]}}') $$,
  'A saves step 2');
select is((select days_per_week || '|' || array_to_string(equipment, ',') || '|' || injury_notes from public.athlete_basics where user_id = 'a0000000-0000-0000-0000-00000000000a'), '4|gloves,rope|old left knee', 'basics are stored, notes trimmed');
select is((select answers->>'experience' from public.athlete_prefs where user_id = 'a0000000-0000-0000-0000-00000000000a' and category_id = 'boxing'), 'few_classes', 'boxing answers are stored on the boxing row');
select is((select granted::text || '|' || notice_version from public.consents where user_id = 'a0000000-0000-0000-0000-00000000000a' and purpose = 'ai_health_personalisation'), 'false|v1', 'an explicit no is stored with the notice version');

-- The same answer again adds no consent row; a new answer or a new notice does.
select lives_ok($$ select public.save_training_basics(5, array['gloves'], 'old left knee', false, 'v1', '{}') $$, 'A saves step 2 again with the same consent');
select is((select count(*)::int from public.consents where user_id = 'a0000000-0000-0000-0000-00000000000a'), 1, 'an unchanged answer adds no consent row');
select lives_ok($$ select public.save_training_basics(5, array['gloves'], 'old left knee', true, 'v1', '{}') $$, 'A now says yes');
select lives_ok($$ select public.save_training_basics(5, array['gloves'], 'old left knee', true, 'v2', '{}') $$, 'A says yes to a new notice');
select is((select array_agg(granted::text || '|' || notice_version order by created_at) from public.consents where user_id = 'a0000000-0000-0000-0000-00000000000a'), array['false|v1', 'true|v1', 'true|v2'], 'each change is its own consent row');
select is((select days_per_week::int from public.athlete_basics where user_id = 'a0000000-0000-0000-0000-00000000000a'), 5, 'saving again updates the basics');

select throws_ok($$ select public.save_training_basics(9, array['gloves'], '', false, 'v1', '{}') $$, '22023', 'bad_days', 'days a week must be 1 to 7');
select throws_ok(format($$ select public.save_training_basics(4, array['gloves'], %L, false, 'v1', '{}') $$, repeat('x', 501)), '22023', 'notes_too_long', 'injury notes are capped at 500 characters');
select throws_ok($$ select public.save_training_basics(4, array['gloves'], '', null, 'v1', '{}') $$, '22023', 'consent_required', 'the AI consent answer must be yes or no');

-- Per-sport answers: only chosen sports, and only short strings or lists of them.
select throws_ok($$ select public.save_training_basics(4, array['gloves'], '', false, 'v1', '{"sc": {"x": "y"}}') $$, '22023', 'sport_not_chosen', 'answers need the sport to be chosen in step 1');
select throws_ok($$ select public.save_training_basics(4, array['gloves'], '', false, 'v1', '{"boxing": {"experience": {"x": 1}}}') $$, '22023', 'bad_answer', 'an answer must be a short string or a list of them');
select throws_ok(format($$ select public.save_training_basics(4, array['gloves'], '', false, 'v1', %L) $$, jsonb_build_object('boxing', jsonb_build_object('experience', repeat('x', 41)))), '22023', 'bad_answer', 'an answer longer than 40 characters is refused');
select is((select answers->>'experience' from public.athlete_prefs where user_id = 'a0000000-0000-0000-0000-00000000000a' and category_id = 'boxing'), 'few_classes', 'a refused save changes nothing');

-- Going back to step 1 keeps the answers of every sport still chosen.
select lives_ok($$ select public.complete_about_you('Kabir', '1998-06-12', array['boxing', 'gym']) $$, 'A saves step 1 again');
select is((select answers->>'experience' from public.athlete_prefs where user_id = 'a0000000-0000-0000-0000-00000000000a' and category_id = 'boxing'), 'few_classes', 'boxing keeps its answers');

-- Step 3: gym answers, measurements and their own consent, in one call.
select lives_ok($$ select public.save_body_metrics(72.5, 168, false, 'v1', '{"gym": {"goal": "muscle", "place": "full_gym", "lifting": "under_1"}}') $$, 'A saves step 3');
select is((select weight_kg::text || '|' || height_cm::text from public.body_metrics where user_id = 'a0000000-0000-0000-0000-00000000000a'), '72.5|168.0', 'the measurements are stored');
select is((select granted from public.consents where user_id = 'a0000000-0000-0000-0000-00000000000a' and purpose = 'ai_body_metrics'), false, 'body metrics have their own consent row');
select lives_ok($$ select public.save_body_metrics(27, 168, false, 'v1', '{}') $$, 'A fixes a typo');
select is((select array_agg(weight_kg::text) from public.body_metrics where user_id = 'a0000000-0000-0000-0000-00000000000a'), array['27.0'], 'a fix replaces the latest measurement, not adds one');
select lives_ok($$ select public.save_body_metrics(null, null, false, 'v1', '{}') $$, 'A clears both fields');
select is_empty($$ select 1 from public.body_metrics where user_id = 'a0000000-0000-0000-0000-00000000000a' $$, 'clearing removes the measurement');
select throws_ok($$ select public.save_body_metrics(5, null, false, 'v1', '{}') $$, '22023', 'bad_weight', 'a weight below 20 kg is refused');

-- B sees none of A's rows.
select set_config('request.jwt.claims', '{"sub":"b0000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
select is((select count(*)::int from public.athlete_basics) + (select count(*)::int from public.body_metrics), 0, 'B cannot read the basics or body metrics of A');

select * from finish();
rollback;
