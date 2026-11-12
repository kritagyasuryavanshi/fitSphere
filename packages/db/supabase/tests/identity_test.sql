-- M1-01: profiles, user_roles, consents and audit_log rules.
begin;
select plan(35);

-- Users A and B are athletes; M is an admin. The sign-up trigger creates their profiles.
insert into auth.users (id, email, email_confirmed_at) values
  ('a0000000-0000-0000-0000-00000000000a', 'a@t.test', now()),
  ('b0000000-0000-0000-0000-00000000000b', 'b@t.test', now()),
  ('c0000000-0000-0000-0000-00000000000c', 'm@t.test', now());
insert into public.user_roles (user_id, role) values ('c0000000-0000-0000-0000-00000000000c', 'admin');

select is((select count(*)::int from public.profiles where id = 'a0000000-0000-0000-0000-00000000000a'), 1, 'sign-up creates a profile');
select is((select array_agg(role::text) from public.user_roles where user_id = 'a0000000-0000-0000-0000-00000000000a'), array['athlete'], 'sign-up grants the athlete role');
select is((select count(*)::int from public.audit_log where target_id = 'c0000000-0000-0000-0000-00000000000c' and action = 'role_granted' and details->>'role' = 'admin'), 1, 'a direct role insert is audited too');

-- As athlete A.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);

select is((select count(*)::int from public.profiles), 1, 'A sees only their own profile');
update public.profiles set display_name = 'Kabir' where id = 'a0000000-0000-0000-0000-00000000000a';
select is((select display_name from public.profiles where id = 'a0000000-0000-0000-0000-00000000000a'), 'Kabir', 'A edits their own profile');
update public.profiles set display_name = 'hacked' where id = 'b0000000-0000-0000-0000-00000000000b';
select throws_ok($$ update public.profiles set created_at = now() where id = 'a0000000-0000-0000-0000-00000000000a' $$, '42501', null, 'A cannot edit protected profile columns');
select throws_ok($$ update public.profiles set date_of_birth = '2000-01-01' where id = 'a0000000-0000-0000-0000-00000000000a' $$, '42501', null, 'A cannot set their date of birth directly; the 18+ check owns it');
select throws_ok($$ insert into public.user_roles (user_id, role) values ('a0000000-0000-0000-0000-00000000000a', 'admin') $$, '42501', null, 'A cannot insert a role row');
select throws_ok($$ update public.user_roles set role = 'admin' where user_id = 'a0000000-0000-0000-0000-00000000000a' $$, '42501', null, 'A cannot change a role row');
select throws_ok($$ delete from public.user_roles where user_id = 'a0000000-0000-0000-0000-00000000000a' $$, '42501', null, 'A cannot delete a role row');
select throws_ok($$ select public.grant_role('a0000000-0000-0000-0000-00000000000a', 'admin') $$, '42501', null, 'A non-admin cannot call grant_role');
select throws_ok($$ select public.revoke_role('b0000000-0000-0000-0000-00000000000b', 'athlete') $$, '42501', null, 'A non-admin cannot call revoke_role');
select is((select count(*)::int from public.user_roles), 1, 'A sees only their own role rows');
select throws_ok($$ insert into public.audit_log (action) values ('fake') $$, '42501', null, 'A cannot write the audit log');
select is_empty($$ select 1 from public.audit_log $$, 'A non-admin reads no audit rows');

select lives_ok($$ insert into public.consents (user_id, purpose, granted) values ('a0000000-0000-0000-0000-00000000000a', 'ai_health_personalisation', true) $$, 'A records their own consent');
select throws_ok($$ insert into public.consents (user_id, purpose, granted) values ('b0000000-0000-0000-0000-00000000000b', 'ai_health_personalisation', true) $$, '42501', null, 'A cannot record consent for B');
select throws_ok($$ update public.consents set granted = false $$, '42501', null, 'A consent row cannot be edited; a new row records a change');

-- As athlete B.
select set_config('request.jwt.claims', '{"sub":"b0000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
select is_empty($$ select 1 from public.consents $$, 'B cannot see the consents of A');

-- As admin M.
select set_config('request.jwt.claims', '{"sub":"c0000000-0000-0000-0000-00000000000c","role":"authenticated"}', true);
select ok((select count(*) from public.profiles) >= 3, 'the admin reads other profiles');
select isnt_empty($$ select 1 from public.audit_log where target_id <> 'c0000000-0000-0000-0000-00000000000c' $$, 'the admin reads the audit log');
select lives_ok($$ select public.grant_role('b0000000-0000-0000-0000-00000000000b', 'coach') $$, 'the admin grants B the coach role');
select is((select count(*)::int from public.audit_log where actor_id = 'c0000000-0000-0000-0000-00000000000c' and target_id = 'b0000000-0000-0000-0000-00000000000b' and action = 'role_granted' and details->>'role' = 'coach'), 1, 'the grant writes an audit row with the actor');
select throws_ok($$ select public.grant_role('c0000000-0000-0000-0000-00000000000c', 'coach') $$, '42501', null, 'the admin cannot grant themselves a role');
select throws_ok($$ select public.revoke_role('c0000000-0000-0000-0000-00000000000c', 'admin') $$, '42501', null, 'the admin cannot revoke their own role');
select throws_ok($$ insert into public.user_roles (user_id, role) values ('b0000000-0000-0000-0000-00000000000b', 'reviewer') $$, '42501', null, 'the admin cannot insert a role row directly');
select lives_ok($$ select public.revoke_role('b0000000-0000-0000-0000-00000000000b', 'coach') $$, 'the admin revokes the coach role');
select is((select count(*)::int from public.audit_log where target_id = 'b0000000-0000-0000-0000-00000000000b' and action = 'role_revoked'), 1, 'the revoke writes an audit row');
select lives_ok($$ select public.grant_role('b0000000-0000-0000-0000-00000000000b', 'reviewer') $$, 'the admin grants B the reviewer role');

-- As postgres again: B's profile is unchanged by A's update.
reset role;
select is((select display_name from public.profiles where id = 'b0000000-0000-0000-0000-00000000000b'), '', 'A could not edit the profile of B');
select is((select count(*)::int from public.audit_log where target_id = 'b0000000-0000-0000-0000-00000000000b'), 4, 'B has four audit rows: sign-up, grant, revoke, grant');
delete from auth.users where id = 'c0000000-0000-0000-0000-00000000000c';
select is((select count(*)::int from public.audit_log where target_id = 'b0000000-0000-0000-0000-00000000000b'), 4, 'deleting the granting admin writes no false audit rows');

insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data) values ('d0000000-0000-0000-0000-00000000000d', 'long@t.test', now(), jsonb_build_object('full_name', repeat('x', 200)));
select is((select char_length(display_name) from public.profiles where id = 'd0000000-0000-0000-0000-00000000000d'), 80, 'a long sign-up name is trimmed, not rejected');

-- A role update audits the revoke before the grant, and each row has its own time.
update public.user_roles set role = 'coach' where user_id = 'd0000000-0000-0000-0000-00000000000d' and role = 'athlete';
select is((select array_agg(action order by id) from public.audit_log where target_id = 'd0000000-0000-0000-0000-00000000000d'), array['role_granted', 'role_revoked', 'role_granted'], 'a role update logs the revoke before the grant');
select is((select count(distinct created_at)::int from public.audit_log where target_id = 'd0000000-0000-0000-0000-00000000000d'), 3, 'audit rows in one transaction get distinct times');

select * from finish();
rollback;
