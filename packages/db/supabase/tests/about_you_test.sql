-- M1-03: sign-up step 1 (name, date of birth, sports). No age limit since 2026-11-12 (owner decision).
begin;
select plan(21);

insert into auth.users (id, email, email_confirmed_at) values
  ('a0000000-0000-0000-0000-00000000000a', 'a@t.test', now()),
  ('b0000000-0000-0000-0000-00000000000b', 'b@t.test', now());

-- Anyone can read the sports list.
set local role anon;
select is((select array_agg(id order by sort) from public.categories where is_live), array['boxing', 'sc', 'gym'], 'anyone reads the live sports');
select is((select is_live from public.categories where id = 'cricket'), false, 'cricket is listed but not live');
select throws_ok($$ select public.complete_about_you('Kabir', '1998-06-12', array['boxing']) $$, '42501', null, 'a signed-out visitor cannot run step 1');

-- As athlete A.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);

select throws_ok($$ insert into public.athlete_prefs (user_id, category_id) values ('a0000000-0000-0000-0000-00000000000a', 'boxing') $$, '42501', null, 'A cannot write sport choices directly');
select throws_ok($$ insert into public.categories (id, name) values ('chess', 'Chess') $$, '42501', null, 'A cannot add a sport');

-- A future date is refused, and a refused attempt stores nothing.
select throws_ok($$ select public.complete_about_you('Kid', (now() + interval '2 days')::date, array['boxing']) $$, '22023', 'dob_in_future', 'a date of birth in the future is refused');
select is((select display_name || '|' || coalesce(date_of_birth::text, 'null') from public.profiles where id = 'a0000000-0000-0000-0000-00000000000a'), '|null', 'a refused attempt stores no name or date of birth');
select is_empty($$ select 1 from public.athlete_prefs where user_id = 'a0000000-0000-0000-0000-00000000000a' $$, 'a refused attempt stores no sports');

-- No age limit: a child can finish step 1 (owner decision, 2026-11-12).
select set_config('request.jwt.claims', '{"sub":"b0000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
select lives_ok(format($$ select public.complete_about_you('Aarav', %L, array['boxing']) $$, ((now() at time zone 'Asia/Kolkata')::date - interval '10 years')::date), 'a 10-year-old can save step 1');
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);

select throws_ok($$ select public.complete_about_you('Kid', null, array['boxing']) $$, '22023', 'dob_required', 'a missing date of birth is refused, so it cannot skip the age check');
select throws_ok($$ select public.complete_about_you('  ', '1998-06-12', array['boxing']) $$, '22023', 'name_required', 'a blank name is refused');
select throws_ok($$ select public.complete_about_you('Kabir', '1998-06-12', array[]::text[]) $$, '22023', 'sport_required', 'no sport is refused');
select throws_ok($$ select public.complete_about_you('Kabir', '1998-06-12', array['cricket']) $$, '22023', 'unknown_sport', 'a sport that is not live is refused');

select lives_ok(
  format($$ select public.complete_about_you('  Kabir ', %L, array['boxing', 'gym', 'boxing']) $$, ((now() at time zone 'Asia/Kolkata')::date - interval '18 years')::date),
  'an adult saves step 1');
select is((select display_name from public.profiles where id = 'a0000000-0000-0000-0000-00000000000a'), 'Kabir', 'the trimmed name is stored');
select is((select array_agg(category_id order by category_id) from public.athlete_prefs where user_id = 'a0000000-0000-0000-0000-00000000000a'), array['boxing', 'gym'], 'each chosen sport is stored once');

-- Coming back to step 1 changes the name and sports, never the date of birth.
select throws_ok($$ select public.complete_about_you('Kabir', '1990-01-01', array['sc']) $$, '22023', 'dob_locked', 'the date of birth cannot be changed');
select throws_ok($$ select public.complete_about_you('Kabir', null, array['sc']) $$, '22023', 'dob_required', 'a null date cannot clear a saved one');
select throws_ok($$ select public.complete_about_you('Kabir', '2020-01-01', array['sc']) $$, '22023', 'dob_locked', 'a different date is refused once one is saved');
select lives_ok(
  format($$ select public.complete_about_you('Kabir S', %L, array['sc']) $$, (select date_of_birth from public.profiles where id = 'a0000000-0000-0000-0000-00000000000a')),
  'step 1 can be saved again with the same date of birth');
select is((select array_agg(category_id) from public.athlete_prefs where user_id = 'a0000000-0000-0000-0000-00000000000a'), array['sc'], 'saving again replaces the sports');

select * from finish();
rollback;
