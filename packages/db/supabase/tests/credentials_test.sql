-- M4-03: credential checks. Only an admin decides; a reject needs a note the coach sees; every decision is logged
-- with the admin and the date; the public badge shows only after an admin marks a credential checked.
begin;
select plan(13);

insert into auth.users (id, email, email_confirmed_at) values
  ('a5000000-0000-0000-0000-0000000000a1', 'coach-c@t.test', now()),
  ('b5000000-0000-0000-0000-0000000000b1', 'coach-d@t.test', now()),
  ('d5000000-0000-0000-0000-0000000000d1', 'admin-c@t.test', now());
insert into public.user_roles (user_id, role) values
  ('a5000000-0000-0000-0000-0000000000a1', 'coach'), ('b5000000-0000-0000-0000-0000000000b1', 'coach'), ('d5000000-0000-0000-0000-0000000000d1', 'admin');

create temp table ids (name text primary key, v text);
grant all on ids to authenticated, anon;
set local role authenticated;

-- Coach A, live, uploads two credentials.
select set_config('request.jwt.claims', '{"sub":"a5000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
select public.save_coach_profile('Boxing coach', '', array['boxing'], array['English'], array['online'], 'Pune', 10, 10);
insert into storage.objects (bucket_id, name, owner) values
  ('credentials', 'a5000000-0000-0000-0000-0000000000a1/aiba.pdf', 'a5000000-0000-0000-0000-0000000000a1'),
  ('credentials', 'a5000000-0000-0000-0000-0000000000a1/cpr.pdf', 'a5000000-0000-0000-0000-0000000000a1');
insert into ids select 'aiba', public.submit_credential('AIBA level 1', 'a5000000-0000-0000-0000-0000000000a1/aiba.pdf', 'AIBA', 'IN-1234');
insert into ids select 'cpr', public.submit_credential('CPR', 'a5000000-0000-0000-0000-0000000000a1/cpr.pdf', 'Red Cross', '');
select is((select issuer || '|' || id_number from public.credentials where id = (select v from ids where name = 'aiba')::uuid), 'AIBA|IN-1234', 'a credential keeps its issuer and ID number');
reset role;
update public.coach_profiles set status = 'live' where coach_id = 'a5000000-0000-0000-0000-0000000000a1';
set local role authenticated;

-- Not an admin: a coach cannot decide, not even their own.
select throws_ok(format($$ select public.decide_credential(%L, true, '') $$, (select v from ids where name = 'aiba')), '42501', 'not_admin', 'a coach cannot mark their own credential checked');

-- The admin rejects one with a note and checks the other.
select set_config('request.jwt.claims', '{"sub":"d5000000-0000-0000-0000-0000000000d1","role":"authenticated"}', true);
select is((select count(*)::int from public.admin_pending_credentials()), 2, 'the admin queue lists both pending credentials');
select is((select coach_name || '|' || title from public.admin_pending_credentials() where id = (select v from ids where name = 'aiba')::uuid), 'Boxing coach|AIBA level 1',
  'with the coach and the title');
select throws_ok(format($$ select public.decide_credential(%L, false, '  ') $$, (select v from ids where name = 'cpr')), '22023', 'note_required', 'a reject needs a note');
select lives_ok(format($$ select public.decide_credential(%L, false, 'The certificate has expired. Upload the renewed one.') $$, (select v from ids where name = 'cpr')), 'the admin rejects with a note');
select lives_ok(format($$ select public.decide_credential(%L, true, '') $$, (select v from ids where name = 'aiba')), 'and marks the other checked');
select throws_ok(format($$ select public.decide_credential(%L, false, 'Changed my mind') $$, (select v from ids where name = 'aiba')), '22023', 'already_decided', 'a decided credential stays decided');
select is((select count(*)::int from public.admin_pending_credentials()), 0, 'the queue is empty');
select is((select count(*)::int from public.audit_log where actor_id = 'd5000000-0000-0000-0000-0000000000d1' and action in ('credential_checked', 'credential_rejected')
  and target_id = 'a5000000-0000-0000-0000-0000000000a1' and created_at is not null), 2, 'each decision is logged with the admin and the date');

-- The coach sees the note; the public sees only the checked one.
select set_config('request.jwt.claims', '{"sub":"a5000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
select is((select status || '|' || note from public.credentials where id = (select v from ids where name = 'cpr')::uuid), 'rejected|The certificate has expired. Upload the renewed one.',
  'the coach sees why it was rejected');
reset role;
set local role anon;
select is((select string_agg(title, ',') from public.public_credentials), 'AIBA level 1', 'the public sees only the checked credential');
select throws_ok($$ select public.admin_pending_credentials() $$, '42501', null, 'and cannot open the admin queue');

select * from finish();
rollback;
