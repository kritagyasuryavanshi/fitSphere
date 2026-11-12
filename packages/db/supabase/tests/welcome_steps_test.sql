-- M1-04: sign-up steps 2 to 4 (training basics, per-sport answers, body metrics, AI consent).
begin;
select plan(21);

insert into auth.users (id, email, email_confirmed_at) values
  ('a0000000-0000-0000-0000-00000000000a', 'a@t.test', now()),
  ('b0000000-0000-0000-0000-00000000000b', 'b@t.test', now());

-- As A, before step 1: later steps are refused.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select throws_ok($$ select public.save_training_basics(4, array['gloves'], '', false) $$, '22023', 'step1_required', 'step 2 needs step 1 first');

select lives_ok($$ select public.complete_about_you('Kabir', '1998-06-12', array['boxing', 'gym']) $$, 'A finishes step 1');

-- Step 2: basics and the explicit AI consent answer.
select lives_ok($$ select public.save_training_basics(4, array['gloves', 'rope'], '  old left knee  ', false) $$, 'A saves training basics');
select is((select days_per_week || '|' || array_to_string(equipment, ',') || '|' || injury_notes from public.athlete_basics where user_id = 'a0000000-0000-0000-0000-00000000000a'), '4|gloves,rope|old left knee', 'basics are stored, notes trimmed');
select is((select granted from public.consents where user_id = 'a0000000-0000-0000-0000-00000000000a' and purpose = 'ai_health_personalisation' order by created_at desc limit 1), false, 'an unticked box stores an explicit no');
select lives_ok($$ select public.save_training_basics(5, array['gloves'], 'old left knee', true) $$, 'A saves step 2 again, now saying yes');
select is((select array_agg(granted order by created_at) from public.consents where user_id = 'a0000000-0000-0000-0000-00000000000a'), array[false, true], 'each answer is its own consent row; the newest is current');
select is((select days_per_week::int from public.athlete_basics where user_id = 'a0000000-0000-0000-0000-00000000000a'), 5, 'saving again updates the basics');

select throws_ok($$ select public.save_training_basics(9, array['gloves'], '', false) $$, '22023', 'bad_days', 'days a week must be 1 to 7');
select throws_ok(format($$ select public.save_training_basics(4, array['gloves'], %L, false) $$, repeat('x', 501)), '22023', 'notes_too_long', 'injury notes are capped at 500 characters');
select throws_ok($$ select public.save_training_basics(4, array['gloves'], '', null) $$, '22023', 'consent_required', 'the AI consent answer must be yes or no');

-- Per-sport answers live on the athlete_prefs row for that sport.
select lives_ok($$ select public.save_sport_answers('boxing', '{"experience": "few_classes", "wants": ["technique"]}') $$, 'A saves boxing answers');
select is((select answers->>'experience' from public.athlete_prefs where user_id = 'a0000000-0000-0000-0000-00000000000a' and category_id = 'boxing'), 'few_classes', 'boxing answers are stored on the boxing row');
select throws_ok($$ select public.save_sport_answers('sc', '{"x": 1}') $$, '22023', 'sport_not_chosen', 'answers need the sport to be chosen in step 1');
select throws_ok($$ select public.save_sport_answers('gym', '[1, 2]') $$, '22023', 'answers_not_object', 'answers must be a JSON object');

-- Going back to step 1 keeps the answers of every sport still chosen, and drops the rest.
select lives_ok($$ select public.complete_about_you('Kabir', '1998-06-12', array['boxing']) $$, 'A saves step 1 again with boxing only');
select is((select array_agg(category_id || ':' || coalesce(answers->>'experience', '-')) from public.athlete_prefs where user_id = 'a0000000-0000-0000-0000-00000000000a'), array['boxing:few_classes'], 'boxing keeps its answers and gym is dropped');

-- Body metrics are optional, and only sensible values are kept.
select lives_ok($$ select public.log_body_metrics(72.5, 168) $$, 'A logs weight and height');
select throws_ok($$ select public.log_body_metrics(5, null) $$, '22023', 'bad_weight', 'a weight below 20 kg is refused');

-- Nobody writes these tables directly, and B sees none of A's rows.
select throws_ok($$ insert into public.athlete_basics (user_id, days_per_week) values ('a0000000-0000-0000-0000-00000000000a', 3) $$, '42501', null, 'A cannot write basics directly');
select set_config('request.jwt.claims', '{"sub":"b0000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
select is((select count(*)::int from public.athlete_basics) + (select count(*)::int from public.body_metrics), 0, 'B cannot read the basics or body metrics of A');

select * from finish();
rollback;
