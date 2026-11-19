-- M4-01: coach profiles, packages, slots and credentials. A coach changes only their own; the public sees only live
-- coaches with the coach role, and only public columns; credential files are private to the coach and admins.
begin;
select plan(32);

insert into auth.users (id, email, email_confirmed_at) values
  ('a4000000-0000-0000-0000-0000000000a1', 'coach-m@t.test', now()),
  ('b4000000-0000-0000-0000-0000000000b1', 'coach-n@t.test', now()),
  ('c4000000-0000-0000-0000-0000000000c1', 'athlete-m@t.test', now()),
  ('d4000000-0000-0000-0000-0000000000d1', 'admin-m@t.test', now());
insert into public.user_roles (user_id, role) values
  ('a4000000-0000-0000-0000-0000000000a1', 'coach'), ('b4000000-0000-0000-0000-0000000000b1', 'coach'), ('d4000000-0000-0000-0000-0000000000d1', 'admin');

create temp table ids (name text primary key, v text);
grant all on ids to authenticated, anon;
set local role authenticated;

-- Coach A writes a profile, a package and slots.
select set_config('request.jwt.claims', '{"sub":"a4000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
select lives_ok($$ select public.save_coach_profile('Boxing coach, 12 years', 'Technique first.', array['boxing'], array['English','Hindi'], array['online'], 'Pune', 12, 8) $$,
  'a coach saves their profile');
-- client_limit is not readable by clients (column grants); check it as the owner.
reset role;
select is((select status || '|' || client_limit from public.coach_profiles where coach_id = 'a4000000-0000-0000-0000-0000000000a1'), 'draft|8', 'it starts as a draft, with the client limit');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a4000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
select throws_ok($$ select public.save_coach_profile('x', '', array[repeat('x', 41)], array['English'], array['online'], '', 1, 5) $$, '22023', 'bad_profile', 'a specialty is at most 40 characters');
select throws_ok($$ select public.save_coach_profile('x', '', array['boxing', ''], array['English'], array['online'], '', 1, 5) $$, '22023', 'bad_profile', 'and never blank');
insert into ids select 'pkg', public.save_package(null, 'Monthly coaching', 'monthly', 450000, true);
select is((select price_paise from public.packages where id = (select v from ids where name = 'pkg')::uuid), 450000::bigint, 'a package stores its price in paise');
select throws_ok($$ select public.save_package(null, 'Free', 'monthly', 0, true) $$, '22023', 'bad_price', 'a price must be above zero');
select throws_ok($$ select public.save_package(null, 'Too much', 'monthly', 100000001, true) $$, '22023', 'bad_price', 'and below ₹10 lakh');
-- As the app sends it (text): a fractional amount never becomes a price.
select throws_ok($$ select public.save_package(null, 'Half paisa', 'monthly', '4500.5', true) $$, '22P02', null, 'only whole paise');
select throws_ok($$ select public.save_package(null, '', 'monthly', 4500, true) $$, '22023', 'bad_package', 'a package needs a title');
select lives_ok($$ select public.set_slots('[{"dow":1,"start":"18:00","minutes":60},{"dow":3,"start":"18:00","minutes":60}]') $$, 'a coach sets weekly slots');
select is((select count(*)::int from public.availability_slots where coach_id = 'a4000000-0000-0000-0000-0000000000a1'), 2, 'and replaces them all at once');
select throws_ok($$ select public.set_slots('[{"dow":8,"start":"18:00","minutes":60}]') $$, '22023', 'bad_slot', 'a slot needs a real weekday');
select throws_ok($$ select public.set_slots('[5]') $$, '22023', 'bad_slot', 'a slot must be an object');
select throws_ok($$ select public.set_slots('[{"start":"18:00","minutes":60}]') $$, '22023', 'bad_slot', 'with every field');
select throws_ok($$ select public.set_slots('[{"dow":1,"start":"23:30","minutes":60}]') $$, '22023', 'bad_slot', 'a slot ends by midnight');
select throws_ok($$ select public.set_slots('[{"dow":1,"start":"18:00","minutes":60},{"dow":1,"start":"18:30","minutes":60}]') $$, '22023', 'bad_slot', 'slots on one day cannot overlap');

-- Coach B cannot change A's package; an athlete cannot have a coach profile.
select set_config('request.jwt.claims', '{"sub":"b4000000-0000-0000-0000-0000000000b1","role":"authenticated"}', true);
select public.save_coach_profile('S&C coach', '', array['sc'], array['English'], array['online'], 'Mumbai', 5, 10);
select throws_ok(format($$ select public.save_package(%L, 'Mine now', 'monthly', 100, true) $$, (select v from ids where name = 'pkg')), '42501', 'not_owner', 'another coach cannot change the package');
select throws_ok($$ insert into public.coach_profiles (coach_id, headline) values ('b4000000-0000-0000-0000-0000000000b1', 'x') $$, '42501', null, 'clients cannot write profiles directly');
select set_config('request.jwt.claims', '{"sub":"c4000000-0000-0000-0000-0000000000c1","role":"authenticated"}', true);
select throws_ok($$ select public.save_coach_profile('Me', '', array['boxing'], array['English'], array['online'], '', 1, 5) $$, '42501', 'not_coach', 'an athlete cannot make a coach profile');

-- The public sees only live coaches, their live packages, and only public columns.
reset role;
set local role anon;
select is((select count(*)::int from public.coach_profiles), 0, 'a draft profile is not public');
reset role;
update public.coach_profiles set status = 'live', agreement_version = public.current_coach_agreement() where coach_id = 'a4000000-0000-0000-0000-0000000000a1';
set local role anon;
select is((select count(*)::int from public.coach_profiles) || '|' || (select count(*)::int from public.packages), '1|1', 'a live coach and their live package are public');
select throws_ok($$ select payout_account_id from public.coach_profiles $$, '42501', null, 'a coach''s payout account is never public');

-- A coach who loses the role drops out of public view and can no longer edit.
reset role;
delete from public.user_roles where user_id = 'a4000000-0000-0000-0000-0000000000a1' and role = 'coach';
set local role anon;
select is((select count(*)::int from public.coach_profiles), 0, 'a coach without the role is not public');
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a4000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
select throws_ok($$ select public.save_package(null, 'Sneaky', 'monthly', 100, true) $$, '42501', 'not_coach', 'and cannot add a package');
reset role;
insert into public.user_roles (user_id, role) values ('a4000000-0000-0000-0000-0000000000a1', 'coach');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a4000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);

-- Credentials: the file must be uploaded first, into the coach's own folder, as one plain file name.
select throws_ok($$ select public.submit_credential('AIBA level 1', 'b4000000-0000-0000-0000-0000000000b1/aiba.pdf') $$, '22023', 'bad_path', 'a credential file sits in the coach''s own folder');
select throws_ok($$ select public.submit_credential('AIBA level 1', 'a4000000-0000-0000-0000-0000000000a1/aiba.pdf') $$, '22023', 'no_file', 'and must be uploaded first');
select throws_ok($$ insert into storage.objects (bucket_id, name, owner) values ('credentials', 'a4000000-0000-0000-0000-0000000000a1/sub/x.pdf', 'a4000000-0000-0000-0000-0000000000a1') $$,
  '42501', null, 'an upload cannot go into a sub-folder');
select lives_ok($$ insert into storage.objects (bucket_id, name, owner) values ('credentials', 'a4000000-0000-0000-0000-0000000000a1/aiba.pdf', 'a4000000-0000-0000-0000-0000000000a1') $$, 'the coach uploads into their own folder');
insert into ids select 'cred', public.submit_credential('AIBA level 1', 'a4000000-0000-0000-0000-0000000000a1/aiba.pdf');
select is((select export_my_data() -> 'coach' ->> 'headline') || '|' || jsonb_array_length(export_my_data() -> 'coach' -> 'credentials'), 'Boxing coach, 12 years|1',
  'the coach''s data download lists their profile and credentials');
select set_config('request.jwt.claims', '{"sub":"b4000000-0000-0000-0000-0000000000b1","role":"authenticated"}', true);
select is((select count(*)::int from storage.objects where bucket_id = 'credentials'), 0, 'another coach cannot see the file');
select set_config('request.jwt.claims', '{"sub":"d4000000-0000-0000-0000-0000000000d1","role":"authenticated"}', true);
select is((select count(*)::int from storage.objects where bucket_id = 'credentials'), 1, 'an admin can');
reset role;
set local role anon;
select is((select count(*)::int from public.public_credentials), 0, 'the public sees a credential only once it is checked');

-- Deleting the account removes the files through the Storage API in the app (deleteAccount), not in SQL.

select * from finish();
rollback;
