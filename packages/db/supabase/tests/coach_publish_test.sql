-- M4-02: a coach reads their own full profile, accepts the current coach agreement, and only then goes live, with a
-- headline and at least one live package. A suspended coach cannot publish.
begin;
select plan(14);

insert into auth.users (id, email, email_confirmed_at) values
  ('a6000000-0000-0000-0000-0000000000a1', 'coach-p@t.test', now()),
  ('b6000000-0000-0000-0000-0000000000b1', 'coach-q@t.test', now());
insert into public.user_roles (user_id, role) values ('a6000000-0000-0000-0000-0000000000a1', 'coach'), ('b6000000-0000-0000-0000-0000000000b1', 'coach');
update public.profiles set display_name = 'Vikram' where id = 'a6000000-0000-0000-0000-0000000000a1';
update public.profiles set display_name = 'Ananya' where id = 'b6000000-0000-0000-0000-0000000000b1';

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a6000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
select public.save_coach_profile('', '', array['boxing'], array['English'], array['online'], 'Pune', 10, 8);

select is((select client_limit || '|' || status || '|' || (agreement_version is null)::text from public.my_coach_profile()), '8|draft|true',
  'a coach reads their own full profile, including the private columns');
select throws_ok($$ select public.set_profile_live(true) $$, '22023', 'agreement_needed', 'a coach cannot go live before accepting the agreement');
select throws_ok($$ select public.accept_coach_agreement('old-version') $$, '22023', 'bad_version', 'only the current agreement can be accepted');
select lives_ok(format($$ select public.accept_coach_agreement(%L) $$, public.current_coach_agreement()), 'the coach accepts the current agreement');
select is((select (agreement_version = public.current_coach_agreement() and agreement_accepted_at is not null)::text from public.my_coach_profile()), 'true',
  'the version and time are recorded');
select throws_ok($$ select public.set_profile_live(true) $$, '22023', 'headline_needed', 'going live needs a headline');
select public.save_coach_profile('Boxing coach, 10 years', 'Shape first.', array['boxing'], array['English'], array['online'], 'Pune', 10, 8);
select throws_ok($$ select public.set_profile_live(true) $$, '22023', 'package_needed', 'and at least one live package');
select public.save_package(null, 'Monthly coaching', 'monthly', 450000, true);
select lives_ok($$ select public.set_profile_live(true) $$, 'with all three, the coach goes live');
set local role anon;
select is((select count(*)::int from public.coach_profiles where coach_id = 'a6000000-0000-0000-0000-0000000000a1'), 1, 'and the public sees the profile');
select is(public.coach_public_name('a6000000-0000-0000-0000-0000000000a1'), 'Vikram', 'with the coach''s name');
select is(public.coach_public_name('b6000000-0000-0000-0000-0000000000b1'), null, 'but no name for a coach who is not live');
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a6000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
select lives_ok($$ select public.set_profile_live(false) $$, 'the coach can unpublish');

-- Suspended by an admin: the coach cannot publish again.
reset role;
update public.coach_profiles set status = 'suspended' where coach_id = 'a6000000-0000-0000-0000-0000000000a1';
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a6000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
select throws_ok($$ select public.set_profile_live(true) $$, '42501', 'suspended', 'a suspended coach cannot publish');

-- Another coach reads only their own.
select set_config('request.jwt.claims', '{"sub":"b6000000-0000-0000-0000-0000000000b1","role":"authenticated"}', true);
select is((select count(*)::int from public.my_coach_profile()), 0, 'my_coach_profile returns only the caller''s profile');

select * from finish();
rollback;
