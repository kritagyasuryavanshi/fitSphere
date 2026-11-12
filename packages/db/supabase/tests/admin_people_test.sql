-- M1-06: admin people and roles.
begin;
select plan(13);

insert into auth.users (id, email, email_confirmed_at) values
  ('a0000000-0000-0000-0000-00000000000a', 'kabir@t.test', now()),
  ('b0000000-0000-0000-0000-00000000000b', 'neha@t.test', now()),
  ('c0000000-0000-0000-0000-00000000000c', 'admin@t.test', now());
update public.profiles set display_name = 'Kabir' where id = 'a0000000-0000-0000-0000-00000000000a';
update public.profiles set display_name = 'Neha' where id = 'b0000000-0000-0000-0000-00000000000b';
insert into public.user_roles (user_id, role) values ('c0000000-0000-0000-0000-00000000000c', 'admin');

-- A non-admin cannot list people or set roles.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select throws_ok($$ select * from public.admin_list_people('') $$, '42501', null, 'a non-admin cannot list people');
select throws_ok($$ select public.admin_set_roles('b0000000-0000-0000-0000-00000000000b', array['coach']::public.app_role[]) $$, '42501', null, 'a non-admin cannot set roles');

-- As the admin.
select set_config('request.jwt.claims', '{"sub":"c0000000-0000-0000-0000-00000000000c","role":"authenticated"}', true);
select is((select count(*)::int from public.admin_list_people('') where email like '%@t.test'), 3, 'the admin lists everyone');
select is((select email from public.admin_list_people('KAB')), 'kabir@t.test', 'search matches the name, ignoring case');
select is((select display_name from public.admin_list_people('neha@')), 'Neha', 'search matches the email');
select is((select roles from public.admin_list_people('kabir')), array['athlete']::public.app_role[], 'each person comes with their roles');

-- Setting roles grants and revokes in one go, and every change is audited.
select lives_ok($$ select public.admin_set_roles('a0000000-0000-0000-0000-00000000000a', array['coach', 'reviewer']::public.app_role[]) $$, 'the admin sets Kabir to coach and reviewer');
select is((select array_agg(role::text order by role) from public.user_roles where user_id = 'a0000000-0000-0000-0000-00000000000a'), array['coach', 'reviewer'], 'Kabir now holds exactly those roles');
select is((select array_agg(action || ':' || (details->>'role') order by id) from public.audit_log where target_id = 'a0000000-0000-0000-0000-00000000000a' and actor_id = 'c0000000-0000-0000-0000-00000000000c'), array['role_revoked:athlete', 'role_granted:coach', 'role_granted:reviewer'], 'each change writes an audit row with the admin as actor');
select lives_ok($$ select public.admin_set_roles('a0000000-0000-0000-0000-00000000000a', array['coach', 'reviewer']::public.app_role[]) $$, 'saving the same roles again');
select is((select count(*)::int from public.audit_log where target_id = 'a0000000-0000-0000-0000-00000000000a' and actor_id = 'c0000000-0000-0000-0000-00000000000c'), 3, 'an unchanged save writes no audit rows');

-- Nobody changes their own roles, and a null list is refused.
select throws_ok($$ select public.admin_set_roles('c0000000-0000-0000-0000-00000000000c', array['athlete']::public.app_role[]) $$, '42501', null, 'the admin cannot change their own roles');
select throws_ok($$ select public.admin_set_roles('a0000000-0000-0000-0000-00000000000a', null) $$, '22023', 'roles_required', 'a null role list is refused');

select * from finish();
rollback;
