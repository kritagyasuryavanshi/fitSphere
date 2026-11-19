-- M4-06: a shortlist is private to its athlete; only live coaches go on it; find_coaches can read a chosen few.
begin;
select plan(11);

insert into auth.users (id, email, email_confirmed_at) values
  ('a9000000-0000-0000-0000-0000000000a1', 'sl-coach1@t.test', now()),
  ('a9000000-0000-0000-0000-0000000000a2', 'sl-coach2@t.test', now()),
  ('a9000000-0000-0000-0000-0000000000a3', 'sl-draft@t.test', now()),
  ('b9000000-0000-0000-0000-0000000000b1', 'sl-kabir@t.test', now()),
  ('b9000000-0000-0000-0000-0000000000b2', 'sl-neha@t.test', now());
insert into public.user_roles (user_id, role)
  select id, 'coach' from auth.users where email like 'sl-coach%' or email = 'sl-draft@t.test';
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

select * from finish();
rollback;
