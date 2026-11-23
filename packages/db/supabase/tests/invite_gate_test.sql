-- M6-15: invite-only admission. While sign-ups are closed, sign-up step 1 refuses anyone not invited, before any
-- write, so email and Google accounts are both gated. Only admins add invites, and each invite is audited.
begin;
select plan(10);

insert into auth.users (id, email, email_confirmed_at) values
  ('1e000000-0000-0000-0000-0000000000a1', 'stranger@t.test', now()),
  ('1e000000-0000-0000-0000-0000000000a2', 'Invited@T.test', now()),
  ('1e000000-0000-0000-0000-0000000000a3', 'returning@t.test', now()),
  ('1e000000-0000-0000-0000-0000000000ad', 'gate-admin@t.test', now());
insert into public.user_roles (user_id, role) values ('1e000000-0000-0000-0000-0000000000ad', 'admin');
-- Someone who passed step 1 before the gate existed.
update public.profiles set date_of_birth = '1990-01-01', display_name = 'Ret' where id = '1e000000-0000-0000-0000-0000000000a3';
update public.app_settings set signups_open = false;

create function pg_temp.as_user(uid text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

set local role authenticated;
select pg_temp.as_user('1e000000-0000-0000-0000-0000000000a1');
select throws_ok($$ select public.complete_about_you('Sam', '1990-05-05', array['boxing']) $$, '42501', 'not_invited', 'an uninvited person is refused');
select is((select date_of_birth from public.profiles where id = '1e000000-0000-0000-0000-0000000000a1'), null, 'the refusal saves nothing');
select throws_ok($$ select public.admin_invite('friend@t.test') $$, '42501', null, 'a non-admin cannot invite');
select throws_ok($$ insert into public.beta_invites (email) values ('me@t.test') $$, '42501', null, 'nobody inserts invites directly');

-- The admin invites, in any letter case.
select pg_temp.as_user('1e000000-0000-0000-0000-0000000000ad');
select lives_ok($$ select public.admin_invite('  invited@t.TEST ') $$, 'an admin invites an address');
select lives_ok($$ select public.admin_invite('invited@t.test') $$, 'inviting twice is harmless');
select is((select count(*)::int from public.audit_log where action = 'beta_invite' and details ->> 'email' = 'invited@t.test'), 1, 'the invite is audited once');

select pg_temp.as_user('1e000000-0000-0000-0000-0000000000a2');
select lives_ok($$ select public.complete_about_you('Neha', '1992-03-03', array['boxing']) $$, 'an invited person passes, whatever the letter case');

select pg_temp.as_user('1e000000-0000-0000-0000-0000000000a3');
select lives_ok($$ select public.complete_about_you('Ret', '1990-01-01', array['gym']) $$, 'someone who already passed step 1 is not locked out');

-- Open sign-ups let anyone through.
reset role;
update public.app_settings set signups_open = true;
set local role authenticated;
select pg_temp.as_user('1e000000-0000-0000-0000-0000000000a1');
select lives_ok($$ select public.complete_about_you('Sam', '1990-05-05', array['boxing']) $$, 'with sign-ups open, anyone passes');


select * from finish();
rollback;
