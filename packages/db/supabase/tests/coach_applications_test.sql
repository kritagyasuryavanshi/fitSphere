-- M1-07: coach applications (apply, review, make coach or decline) and the email outbox.
begin;
select plan(23);

insert into auth.users (id, email, email_confirmed_at) values
  ('a0000000-0000-0000-0000-00000000000a', 'meerazq@t.test', now()),
  ('b0000000-0000-0000-0000-00000000000b', 'ravizq@t.test', now()),
  ('c0000000-0000-0000-0000-00000000000c', 'adminzq@t.test', now());
update public.profiles set display_name = 'Meera', date_of_birth = '1990-01-01' where id = 'a0000000-0000-0000-0000-00000000000a';
update public.profiles set display_name = 'Ravi', date_of_birth = '1990-01-01' where id = 'b0000000-0000-0000-0000-00000000000b';
insert into public.user_roles (user_id, role) values ('c0000000-0000-0000-0000-00000000000c', 'admin');

-- A guest cannot apply.
set local role anon;
select throws_ok($$ select public.submit_coach_application('Meera', 'boxing', 'Kochi', 6, 'https://youtube.com/@m', 'WhatsApp') $$, '42501', null, 'a guest cannot apply');

-- Meera applies.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select lives_ok($$ select public.submit_coach_application('  Meera Pillai ', 'boxing', 'Kochi', 6, 'https://youtube.com/@meeraboxing', 'WhatsApp and a Google Sheet.') $$, 'Meera applies');
select is((select status::text || '|' || full_name || '|' || years_coaching from public.coach_applications where user_id = 'a0000000-0000-0000-0000-00000000000a'), 'pending|Meera Pillai|6', 'the application is pending, name trimmed');
select throws_ok($$ select public.submit_coach_application('Meera', 'boxing', 'Kochi', 6, 'https://youtube.com/@m', 'x') $$, '22023', 'already_applied', 'one pending application per person');
select throws_ok($$ insert into public.coach_applications (user_id, full_name, category_id, city, years_coaching) values ('a0000000-0000-0000-0000-00000000000a', 'x', 'boxing', 'x', 1) $$, '42501', null, 'nobody writes applications directly');
select throws_ok($$ select public.decide_coach_application((select id from public.coach_applications limit 1), true) $$, '42501', null, 'an applicant cannot approve themselves');
select throws_ok($$ select * from public.email_outbox $$, '42501', null, 'nobody reads the email outbox from the app');

-- Ravi: bad input is refused.
select set_config('request.jwt.claims', '{"sub":"b0000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
select throws_ok($$ select public.submit_coach_application('Ravi', 'cricket', 'Pune', 3, '', '') $$, '22023', 'unknown_sport', 'only live sports');
select throws_ok($$ select public.submit_coach_application('Ravi', 'gym', 'Pune', 90, '', '') $$, '22023', 'bad_years', 'years coaching must be 0 to 60');
select throws_ok($$ select public.submit_coach_application('Ravi', 'gym', 'Pune', 3, 'javascript:alert(1)', '') $$, '22023', 'bad_link', 'the work link must be http or https');
select is_empty($$ select 1 from public.coach_applications where user_id = 'a0000000-0000-0000-0000-00000000000a' $$, 'Ravi cannot see the application of Meera');
select lives_ok($$ select public.submit_coach_application('Ravi', 'gym', 'Pune', 3, '', 'Paper notes') $$, 'Ravi applies');

-- The admin approves Meera and declines Ravi.
select set_config('request.jwt.claims', '{"sub":"c0000000-0000-0000-0000-00000000000c","role":"authenticated"}', true);
select is((select count(*)::int from public.coach_applications where status = 'pending' and user_id in ('a0000000-0000-0000-0000-00000000000a', 'b0000000-0000-0000-0000-00000000000b')), 2, 'the admin sees both pending applications');
select lives_ok($$ select public.decide_coach_application((select id from public.coach_applications where user_id = 'a0000000-0000-0000-0000-00000000000a'), true) $$, 'the admin makes Meera a coach');
select lives_ok($$ select public.decide_coach_application((select id from public.coach_applications where user_id = 'b0000000-0000-0000-0000-00000000000b'), false) $$, 'the admin declines Ravi');
select throws_ok($$ select public.decide_coach_application((select id from public.coach_applications where user_id = 'b0000000-0000-0000-0000-00000000000b'), true) $$, '22023', 'already_decided', 'a decision is final');

reset role;
select is((select array_agg(role::text order by role) from public.user_roles where user_id = 'a0000000-0000-0000-0000-00000000000a'), array['athlete', 'coach'], 'Meera is now a coach, and the grant is audited by the role trigger');
select is((select array_agg(to_email || ':' || template order by to_email) from public.email_outbox where to_email like '%zq@t.test'), array['meerazq@t.test:coach_approved', 'ravizq@t.test:coach_declined'], 'each decision queues an email to the applicant');

-- Ravi was declined: he must wait 30 days before applying again.
select set_config('request.jwt.claims', '{"sub":"b0000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
set local role authenticated;
select throws_ok($$ select public.submit_coach_application('Ravi', 'gym', 'Pune', 3, '', '') $$, '22023', 'recently_declined', 'a declined applicant waits 30 days');
select throws_ok($$ select decided_by from public.coach_applications where user_id = 'b0000000-0000-0000-0000-00000000000b' $$, '42501', null, 'an applicant cannot see which admin decided');

-- The admin list shows the account email, so a copied name cannot fool the admin.
select set_config('request.jwt.claims', '{"sub":"c0000000-0000-0000-0000-00000000000c","role":"authenticated"}', true);
reset role;
insert into auth.users (id, email, email_confirmed_at) values ('d0000000-0000-0000-0000-00000000000d', 'samzq@t.test', now());
update public.profiles set date_of_birth = '1990-01-01' where id = 'd0000000-0000-0000-0000-00000000000d';
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"d0000000-0000-0000-0000-00000000000d","role":"authenticated"}', true);
select lives_ok($$ select public.submit_coach_application('Meera Pillai', 'boxing', 'Kochi', 6, '', '') $$, 'Sam applies under a famous name');
select throws_ok($$ select * from public.admin_list_applications() $$, '42501', null, 'only an admin lists applications');
select set_config('request.jwt.claims', '{"sub":"c0000000-0000-0000-0000-00000000000c","role":"authenticated"}', true);
select is((select email from public.admin_list_applications() where full_name = 'Meera Pillai'), 'samzq@t.test', 'the admin sees the real account email');

select * from finish();
rollback;
