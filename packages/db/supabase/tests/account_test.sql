-- M1-08: account (consent switches, data download, delete account).
begin;
select plan(22);

-- Test notice versions; the real ones are seeded by the M1-08 migration.
insert into public.consent_notices (purpose, version) values
  ('ai_health_personalisation', 'v1'), ('ai_health_personalisation', 'v2'), ('ai_body_metrics', 'v1');

insert into auth.users (id, email, email_confirmed_at) values
  ('a0000000-0000-0000-0000-00000000000a', 'kabiracct@t.test', now()),
  ('b0000000-0000-0000-0000-00000000000b', 'nehaacct@t.test', now()),
  ('c0000000-0000-0000-0000-00000000000c', 'adminacct@t.test', now());
insert into public.user_roles (user_id, role) values ('c0000000-0000-0000-0000-00000000000c', 'admin');

-- Kabir finishes sign-up and applies to coach, so every kind of personal row exists.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select public.complete_about_you('Kabir', '1998-06-12', array['boxing', 'gym']);
select public.save_training_basics(4, array['gloves'], 'old left knee', false, 'v1', '{"boxing": {"experience": "new"}}');
select public.save_body_metrics(72, 168, false, 'v1', '{"gym": {"goal": "muscle"}}');
select public.submit_coach_application('Kabir', 'boxing', 'Pune', 2, '', 'notes');

-- Consent switches take effect at once and each change is a logged row.
select throws_ok($$ select public.save_training_basics(4, array['gloves'], '', true, 'made-up', '{}') $$, '22023', 'bad_notice', 'a consent answer must name a notice the server knows');
select lives_ok($$ select public.set_my_consent('ai_health_personalisation', true) $$, 'Kabir turns injury notes for AI on');
select is((select notice_version from public.consents where user_id = 'a0000000-0000-0000-0000-00000000000a' order by created_at desc limit 1), (select version from public.consent_notices where purpose = 'ai_health_personalisation' and is_current), 'the switch records the current notice, chosen by the server');
select lives_ok($$ select public.set_my_consent('ai_health_personalisation', false) $$, 'and off again');
select is((select granted from public.consents where user_id = 'a0000000-0000-0000-0000-00000000000a' and purpose = 'ai_health_personalisation' order by created_at desc limit 1), false, 'the newest answer is off, so it takes effect at once');
select is((select count(*)::int from public.consents where user_id = 'a0000000-0000-0000-0000-00000000000a' and purpose = 'ai_health_personalisation'), 3, 'every change is its own logged row');
select throws_ok($$ select public.set_my_consent('ai_health_personalisation', null) $$, '22023', 'consent_required', 'a switch needs a yes or no');

-- The download holds the person's own data, and only theirs.
select is((select public.export_my_data() ->> 'email'), 'kabiracct@t.test', 'the download includes the email');
select is((select public.export_my_data() -> 'profile' ->> 'display_name'), 'Kabir', 'and the profile');
select is((select jsonb_array_length(public.export_my_data() -> 'consents')), 4, 'and every consent row (injury notes and body metrics)');
select is((select public.export_my_data() -> 'training' ->> 'injury_notes'), 'old left knee', 'and the training basics');
select is((select jsonb_array_length(public.export_my_data() -> 'body_metrics')), 1, 'and the measurements');
select is((select jsonb_array_length(public.export_my_data() -> 'coach_applications')), 1, 'and coach applications');
select ok((select public.export_my_data() ? 'account_created_at'), 'and when the account was made');
select ok((select jsonb_array_length(public.export_my_data() -> 'audit_events') >= 1), 'and the audit events about the person');
select ok((select public.export_my_data() ? 'queued_emails'), 'and any queued emails');
select set_config('request.jwt.claims', '{"sub":"b0000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
select is((select public.export_my_data() ->> 'email'), 'nehaacct@t.test', 'Neha downloads only her own data');

-- An admin cannot delete their own account, so the app never runs out of admins.
select set_config('request.jwt.claims', '{"sub":"c0000000-0000-0000-0000-00000000000c","role":"authenticated"}', true);
select throws_ok($$ select public.delete_my_account() $$, '22023', 'admin_cannot_delete', 'an admin must lose the admin role before deleting');

-- Kabir deletes his account; queued emails go too, even one sent to an address he has since changed.
reset role;
insert into public.email_outbox (to_email, template) values ('KabirAcct@t.test', 'coach_declined');
insert into public.email_outbox (user_id, to_email, template) values ('a0000000-0000-0000-0000-00000000000a', 'kabir-old@t.test', 'coach_approved');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select lives_ok($$ select public.delete_my_account() $$, 'Kabir deletes his account');

reset role;
select is(
  (select count(*)::int from auth.users where id = 'a0000000-0000-0000-0000-00000000000a')
  + (select count(*)::int from public.profiles where id = 'a0000000-0000-0000-0000-00000000000a')
  + (select count(*)::int from public.user_roles where user_id = 'a0000000-0000-0000-0000-00000000000a')
  + (select count(*)::int from public.consents where user_id = 'a0000000-0000-0000-0000-00000000000a')
  + (select count(*)::int from public.athlete_prefs where user_id = 'a0000000-0000-0000-0000-00000000000a')
  + (select count(*)::int from public.athlete_basics where user_id = 'a0000000-0000-0000-0000-00000000000a')
  + (select count(*)::int from public.body_metrics where user_id = 'a0000000-0000-0000-0000-00000000000a')
  + (select count(*)::int from public.coach_applications where user_id = 'a0000000-0000-0000-0000-00000000000a')
  + (select count(*)::int from public.email_outbox where lower(to_email) in ('kabiracct@t.test', 'kabir-old@t.test'))
  + (select count(*)::int from auth.identities where user_id = 'a0000000-0000-0000-0000-00000000000a')
  + (select count(*)::int from auth.sessions where user_id = 'a0000000-0000-0000-0000-00000000000a'),
  0, 'nothing personal remains: account, profile, roles, consents, answers, health data, applications, emails');
-- The audit log keeps role events by id only: no name, email or health data.
select is_empty($$ select 1 from public.audit_log where details::text ilike '%kabir%' or details::text ilike '%knee%' $$, 'the audit log holds nothing personal');
select is((select count(*)::int from public.audit_log where action = 'account_deleted' and target_id = 'a0000000-0000-0000-0000-00000000000a'), 1, 'the erasure itself is recorded, by id only');

select * from finish();
rollback;
