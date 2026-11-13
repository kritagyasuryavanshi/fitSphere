-- M1-02: a profile and the athlete role appear only once the email is confirmed.
begin;
select plan(8);

-- An email-link sign-in creates an unconfirmed auth user before the link is clicked.
insert into auth.users (id, email) values ('e0000000-0000-0000-0000-00000000000e', 'e@t.test');
select is_empty($$ select 1 from public.profiles where id = 'e0000000-0000-0000-0000-00000000000e' $$, 'an unconfirmed sign-up gets no profile');
select is_empty($$ select 1 from public.user_roles where user_id = 'e0000000-0000-0000-0000-00000000000e' $$, 'an unconfirmed sign-up gets no role');

-- Clicking the link confirms the email.
update auth.users set email_confirmed_at = now() where id = 'e0000000-0000-0000-0000-00000000000e';
select is((select count(*)::int from public.profiles where id = 'e0000000-0000-0000-0000-00000000000e'), 1, 'confirming the email creates the profile');
select is((select array_agg(role::text) from public.user_roles where user_id = 'e0000000-0000-0000-0000-00000000000e'), array['athlete'], 'confirming the email grants the athlete role');

-- A suspended user who confirms again does not get the athlete role back.
delete from public.user_roles where user_id = 'e0000000-0000-0000-0000-00000000000e';
update auth.users set email_confirmed_at = null where id = 'e0000000-0000-0000-0000-00000000000e';
update auth.users set email_confirmed_at = now() where id = 'e0000000-0000-0000-0000-00000000000e';
select is_empty($$ select 1 from public.user_roles where user_id = 'e0000000-0000-0000-0000-00000000000e' $$, 'a second confirmation does not grant the role again');

-- Google sign-in creates the user already confirmed.
insert into auth.users (id, email, email_confirmed_at) values ('f0000000-0000-0000-0000-00000000000f', 'f@t.test', now());
select is((select count(*)::int from public.profiles where id = 'f0000000-0000-0000-0000-00000000000f'), 1, 'a user created confirmed gets a profile at once');

-- A password set before confirmation is dropped, so nobody can plant one on a stranger's address.
insert into auth.users (id, email, encrypted_password) values ('a1000000-0000-0000-0000-0000000000a1', 'p@t.test', 'planted-hash');
update auth.users set email_confirmed_at = now() where id = 'a1000000-0000-0000-0000-0000000000a1';
select is((select encrypted_password from auth.users where id = 'a1000000-0000-0000-0000-0000000000a1'), '', 'confirming the email drops a password set before it');
-- Seeded test users are created confirmed, so they keep their password.
insert into auth.users (id, email, encrypted_password, email_confirmed_at) values ('a2000000-0000-0000-0000-0000000000a2', 'q@t.test', 'kept-hash', now());
select is((select encrypted_password from auth.users where id = 'a2000000-0000-0000-0000-0000000000a2'), 'kept-hash', 'a user created confirmed keeps their password');

select * from finish();
rollback;
