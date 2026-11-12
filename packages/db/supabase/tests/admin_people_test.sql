-- M1-06: admin people and roles.
begin;
select plan(17);

insert into auth.users (id, email, email_confirmed_at) values
  ('a0000000-0000-0000-0000-00000000000a', 'qabirzed@t.test', now()),
  ('b0000000-0000-0000-0000-00000000000b', 'nehazquill@t.test', now()),
  ('c0000000-0000-0000-0000-00000000000c', 'adminzq@t.test', now());
update public.profiles set display_name = 'Qabir Zed' where id = 'a0000000-0000-0000-0000-00000000000a';
update public.profiles set display_name = 'Nehaz Quill' where id = 'b0000000-0000-0000-0000-00000000000b';
insert into public.user_roles (user_id, role) values ('c0000000-0000-0000-0000-00000000000c', 'admin');
-- A name with a backslash, for the search test at the end.
insert into auth.users (id, email, email_confirmed_at) values ('d0000000-0000-0000-0000-00000000000d', 'backslashzq@t.test', now());
update public.profiles set display_name = 'Back\slash' where id = 'd0000000-0000-0000-0000-00000000000d';

-- A non-admin cannot list people or set roles.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select throws_ok($$ select * from public.admin_list_people('') $$, '42501', null, 'a non-admin cannot list people');
select throws_ok($$ select public.admin_set_roles('b0000000-0000-0000-0000-00000000000b', array['coach']::public.app_role[], array['athlete']::public.app_role[]) $$, '42501', null, 'a non-admin cannot set roles');

-- As the admin.
select set_config('request.jwt.claims', '{"sub":"c0000000-0000-0000-0000-00000000000c","role":"authenticated"}', true);
select is((select count(*)::int from public.admin_list_people('') where email in ('qabirzed@t.test', 'nehazquill@t.test', 'adminzq@t.test')), 3, 'the admin lists everyone');
select is((select email from public.admin_list_people('QABIR Z')), 'qabirzed@t.test', 'search matches the name, ignoring case');
select is((select display_name from public.admin_list_people('nehazquill@')), 'Nehaz Quill', 'search matches the email');
select is((select roles from public.admin_list_people('qabirzed@')), array['athlete']::public.app_role[], 'each person comes with their roles');

-- Setting roles grants and revokes in one go, and every change is audited.
select lives_ok($$ select public.admin_set_roles('a0000000-0000-0000-0000-00000000000a', array['coach', 'reviewer']::public.app_role[], array['athlete']::public.app_role[]) $$, 'the admin sets Kabir to coach and reviewer');
select is((select array_agg(role::text order by role) from public.user_roles where user_id = 'a0000000-0000-0000-0000-00000000000a'), array['coach', 'reviewer'], 'Kabir now holds exactly those roles');
select is((select array_agg(action || ':' || (details->>'role') order by id) from public.audit_log where target_id = 'a0000000-0000-0000-0000-00000000000a' and actor_id = 'c0000000-0000-0000-0000-00000000000c'), array['role_revoked:athlete', 'role_granted:coach', 'role_granted:reviewer'], 'each change writes an audit row with the admin as actor');
select lives_ok($$ select public.admin_set_roles('a0000000-0000-0000-0000-00000000000a', array['coach', 'reviewer']::public.app_role[], array['coach', 'reviewer']::public.app_role[]) $$, 'saving the same roles again');
select is((select count(*)::int from public.audit_log where target_id = 'a0000000-0000-0000-0000-00000000000a' and actor_id = 'c0000000-0000-0000-0000-00000000000c'), 3, 'an unchanged save writes no audit rows');

-- Nobody changes their own roles, and a null list is refused.
select throws_ok($$ select public.admin_set_roles('c0000000-0000-0000-0000-00000000000c', array['athlete']::public.app_role[], array['admin']::public.app_role[]) $$, '42501', null, 'the admin cannot change their own roles');
select throws_ok($$ select public.admin_set_roles('a0000000-0000-0000-0000-00000000000a', null, array['coach', 'reviewer']::public.app_role[]) $$, '22023', 'roles_required', 'a null role list is refused');
select throws_ok($$ select public.admin_set_roles('a0000000-0000-0000-0000-00000000000a', array[]::public.app_role[], array['coach', 'reviewer']::public.app_role[]) $$, '22023', 'roles_required', 'nobody is left with no role');
-- A stale page cannot overwrite another admin's change: the roles the page saw must still be the roles held.
select throws_ok($$ select public.admin_set_roles('a0000000-0000-0000-0000-00000000000a', array['athlete']::public.app_role[], array['coach']::public.app_role[]) $$, '40001', 'roles_changed', 'a save from a stale page is refused');
select is((select array_agg(role::text order by role) from public.user_roles where user_id = 'a0000000-0000-0000-0000-00000000000a'), array['coach', 'reviewer'], 'the refused save changed nothing');


-- A backslash in a search is a plain character.
select is((select count(*)::int from public.admin_list_people('back\s')), 1, 'a backslash in a search matches itself');

select * from finish();
rollback;
