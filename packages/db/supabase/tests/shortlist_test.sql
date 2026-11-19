-- M4-06: a shortlist is private to its athlete; only live coaches go on it; find_coaches can read a chosen few.
begin;
select plan(14);

insert into auth.users (id, email, email_confirmed_at) values
  ('a9000000-0000-0000-0000-0000000000a1', 'sl-coach1@t.test', now()),
  ('a9000000-0000-0000-0000-0000000000a2', 'sl-coach2@t.test', now()),
  ('a9000000-0000-0000-0000-0000000000a3', 'sl-draft@t.test', now()),
  ('b9000000-0000-0000-0000-0000000000b1', 'sl-kabir@t.test', now()),
  ('b9000000-0000-0000-0000-0000000000b2', 'sl-neha@t.test', now());
insert into public.user_roles (user_id, role)
  select id, 'coach' from auth.users where email like 'sl-coach%' or email = 'sl-draft@t.test';
-- The sign-up trigger gave everyone the athlete role; coach 2 is a coach only.
delete from public.user_roles where user_id = 'a9000000-0000-0000-0000-0000000000a2' and role = 'athlete';
insert into public.coach_profiles (coach_id, headline, status, agreement_version) values
  ('a9000000-0000-0000-0000-0000000000a1', 'One', 'live', public.current_coach_agreement()),
  ('a9000000-0000-0000-0000-0000000000a2', 'Two', 'live', public.current_coach_agreement()),
  ('a9000000-0000-0000-0000-0000000000a3', 'Draft', 'draft', public.current_coach_agreement());

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"b9000000-0000-0000-0000-0000000000b1","role":"authenticated"}', true);
select lives_ok($$ select public.shortlist_coach('a9000000-0000-0000-0000-0000000000a1', true) $$, 'an athlete shortlists a live coach');
select lives_ok($$ select public.shortlist_coach('a9000000-0000-0000-0000-0000000000a1', true) $$, 'twice is fine');
select public.shortlist_coach('a9000000-0000-0000-0000-0000000000a2', true);
select is((select count(*)::int from public.shortlists), 2, 'the athlete sees their own shortlist');
select throws_ok($$ select public.shortlist_coach('a9000000-0000-0000-0000-0000000000a3', true) $$, '22023', 'not_live', 'a coach who is not live cannot be shortlisted');
select throws_ok($$ insert into public.shortlists (athlete_id, coach_id) values ('b9000000-0000-0000-0000-0000000000b1', 'a9000000-0000-0000-0000-0000000000a3') $$,
  '42501', null, 'no direct writes');
select is((select jsonb_array_length(public.export_my_data() -> 'shortlist')), 2, 'the shortlist is in the data download');
select is((select string_agg(headline, ',' order by headline) from public.find_coaches(ids => array['a9000000-0000-0000-0000-0000000000a2'::uuid, 'a9000000-0000-0000-0000-0000000000a3'::uuid])),
  'Two', 'find_coaches reads chosen coaches, live ones only');

-- Another athlete, and a coach, see nothing of it.
select set_config('request.jwt.claims', '{"sub":"b9000000-0000-0000-0000-0000000000b2","role":"authenticated"}', true);
select is((select count(*)::int from public.shortlists), 0, 'another athlete cannot see it');
select set_config('request.jwt.claims', '{"sub":"a9000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
select is((select count(*)::int from public.shortlists), 0, 'the coach is not told');
select throws_ok($$ select public.shortlist_coach('a9000000-0000-0000-0000-0000000000a1', true) $$, '22023', 'own_profile', 'a coach cannot shortlist themselves');

select set_config('request.jwt.claims', '{"sub":"b9000000-0000-0000-0000-0000000000b1","role":"authenticated"}', true);
select public.shortlist_coach('a9000000-0000-0000-0000-0000000000a1', false);
select is((select string_agg(coach_id::text, ',') from public.shortlists), 'a9000000-0000-0000-0000-0000000000a2', 'removing takes the coach off');

select throws_ok($$ select public.shortlist_coach('a9000000-0000-0000-0000-0000000000a1', null) $$, '22023', 'bad_input', 'on or off must be given');
-- A coach who stops being live stays on the list (so it can be removed) but no longer counts toward the 20.
reset role;
insert into auth.users (id, email, email_confirmed_at)
  select ('c9000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid, 'sl-x' || n || '@t.test', now() from generate_series(1, 20) n;
insert into public.user_roles (user_id, role) select id, 'coach' from auth.users where email like 'sl-x%';
insert into public.coach_profiles (coach_id, headline, status, agreement_version)
  select id, 'X', 'live', 'an-older-version' from auth.users where email like 'sl-x%';
insert into public.shortlists (athlete_id, coach_id) select 'b9000000-0000-0000-0000-0000000000b1', id from auth.users where email like 'sl-x%';
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"b9000000-0000-0000-0000-0000000000b1","role":"authenticated"}', true);
select lives_ok($$ select public.shortlist_coach('a9000000-0000-0000-0000-0000000000a1', true) $$, 'coaches no longer live do not fill the shortlist');
-- Shortlists belong to athletes.
select set_config('request.jwt.claims', '{"sub":"a9000000-0000-0000-0000-0000000000a2","role":"authenticated"}', true);
select throws_ok($$ select public.shortlist_coach('a9000000-0000-0000-0000-0000000000a1', true) $$, '42501', 'not_athlete', 'an account without the athlete role cannot shortlist');
select * from finish();
rollback;
