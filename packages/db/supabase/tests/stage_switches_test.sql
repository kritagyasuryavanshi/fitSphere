-- M6-10: stage switches. While the marketplace is closed (beta step 1, decision-m6-launch), the database refuses new
-- hire requests, accepts, conversations and messages by any path. Coaches stay browsable; withdrawing and declining
-- still work. One setting opens it for step 2.
begin;
select plan(18);

insert into auth.users (id, email, email_confirmed_at) values
  ('f9000000-0000-0000-0000-0000000000c1', 'ss-vikram@t.test', now()),
  ('f9000000-0000-0000-0000-0000000000a1', 'ss-kabir@t.test', now()),
  ('f9000000-0000-0000-0000-0000000000a2', 'ss-neha@t.test', now()),
  ('f9000000-0000-0000-0000-0000000000a3', 'ss-ravi@t.test', now()),
  ('f9000000-0000-0000-0000-0000000000a4', 'ss-isha@t.test', now());
insert into public.user_roles (user_id, role) values ('f9000000-0000-0000-0000-0000000000c1', 'coach');
insert into public.coach_profiles (coach_id, headline, status, agreement_version) values
  ('f9000000-0000-0000-0000-0000000000c1', 'Boxing', 'live', public.current_coach_agreement());
insert into public.packages (id, coach_id, title, kind, price_paise, live) values
  ('f9100000-0000-0000-0000-0000000000b1', 'f9000000-0000-0000-0000-0000000000c1', 'Online coaching', 'monthly', 450000, true);
-- While open: Kabir and Ravi asked; Neha is a client with a conversation.
update public.app_settings set marketplace_open = true;
insert into public.engagements (id, athlete_id, coach_id, package_title, package_kind, price_paise, fee_bps, start_date, days_per_week, status, share_data) values
  ('f9200000-0000-0000-0000-0000000000e1', 'f9000000-0000-0000-0000-0000000000a1', 'f9000000-0000-0000-0000-0000000000c1', 'Online coaching', 'monthly', 450000, 1500, public.india_today() + 3, 3, 'requested', true),
  ('f9200000-0000-0000-0000-0000000000e2', 'f9000000-0000-0000-0000-0000000000a2', 'f9000000-0000-0000-0000-0000000000c1', 'Online coaching', 'monthly', 450000, 1500, public.india_today() - 3, 3, 'active', true),
  ('f9200000-0000-0000-0000-0000000000e3', 'f9000000-0000-0000-0000-0000000000a3', 'f9000000-0000-0000-0000-0000000000c1', 'Online coaching', 'monthly', 450000, 1500, public.india_today() + 3, 3, 'requested', true);
insert into public.conversations (id, athlete_id, coach_id) values
  ('f9300000-0000-0000-0000-0000000000d1', 'f9000000-0000-0000-0000-0000000000a2', 'f9000000-0000-0000-0000-0000000000c1');

create function pg_temp.as_user(uid text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;
grant execute on all functions in schema pg_temp to authenticated, anon;

-- Close it, as production is.
update public.app_settings set marketplace_open = false;
set local role anon;
select is(public.marketplace_open(), false, 'anyone can read that the marketplace is closed');
reset role;

set local role authenticated;
select pg_temp.as_user('f9000000-0000-0000-0000-0000000000a4');
select throws_ok($$ select public.request_coaching('f9100000-0000-0000-0000-0000000000b1', public.india_today() + 5, 3::smallint, '', true) $$,
  '22023', 'marketplace_closed', 'nobody sends a hire request');
select pg_temp.as_user('f9000000-0000-0000-0000-0000000000a2');
select throws_ok($$ select public.send_message('f9300000-0000-0000-0000-0000000000d1', 'Hello') $$, '22023', 'closed', 'nobody sends a message');
select is((select can_send from public.my_conversations() where conversation_id = 'f9300000-0000-0000-0000-0000000000d1'), false, 'and the chat says it cannot send');
select is((select count(*)::int from public.my_conversations()), 1, 'the history stays readable');
select pg_temp.as_user('f9000000-0000-0000-0000-0000000000c1');
select throws_ok($$ select public.decide_request('f9200000-0000-0000-0000-0000000000e1', true) $$, '22023', 'marketplace_closed', 'a coach cannot accept a request');
select lives_ok($$ select public.decide_request('f9200000-0000-0000-0000-0000000000e3', false) $$, 'but can decline one');
select throws_ok($$ select public.open_conversation('f9200000-0000-0000-0000-0000000000e1') $$, '22023', 'marketplace_closed', 'nobody starts a conversation');
select is(public.open_conversation('f9200000-0000-0000-0000-0000000000e2'), 'f9300000-0000-0000-0000-0000000000d1'::uuid, 'an existing conversation still opens, to read');
select throws_ok($$ update public.app_settings set marketplace_open = true $$, '42501', null, 'nobody signed in can open the marketplace');
select pg_temp.as_user('f9000000-0000-0000-0000-0000000000a1');
select lives_ok($$ select public.withdraw_request('f9200000-0000-0000-0000-0000000000e1') $$, 'an athlete can still withdraw a request');
reset role;

-- No path round it: the guards are on the tables.
select throws_ok($$ insert into public.engagements (athlete_id, coach_id, package_title, package_kind, price_paise, fee_bps, start_date, days_per_week, status, share_data)
  values ('f9000000-0000-0000-0000-0000000000a3', 'f9000000-0000-0000-0000-0000000000c1', 'Online coaching', 'monthly', 450000, 1500, public.india_today() + 3, 3, 'requested', true) $$,
  '22023', 'marketplace_closed', 'even the server cannot add a request');
select throws_ok($$ insert into public.messages (conversation_id, sender_id, body) values ('f9300000-0000-0000-0000-0000000000d1', 'f9000000-0000-0000-0000-0000000000a2', 'Hi') $$,
  '22023', 'marketplace_closed', 'or a message');
select throws_ok($$ insert into public.conversations (athlete_id, coach_id) values ('f9000000-0000-0000-0000-0000000000a1', 'f9000000-0000-0000-0000-0000000000c1') $$,
  '22023', 'marketplace_closed', 'or a conversation');
select lives_ok($$ update public.engagements set status = 'ended', ended_at = now() where id = 'f9200000-0000-0000-0000-0000000000e2' $$, 'coaching already running can still end');

-- Step 2: one setting opens it.
update public.app_settings set marketplace_open = true;
update public.engagements set status = 'active', ended_at = null where id = 'f9200000-0000-0000-0000-0000000000e2';
set local role authenticated;
select pg_temp.as_user('f9000000-0000-0000-0000-0000000000a1');
select lives_ok($$ select public.request_coaching('f9100000-0000-0000-0000-0000000000b1', public.india_today() + 5, 3::smallint, '', true) $$, 'once open, an athlete can ask');
select pg_temp.as_user('f9000000-0000-0000-0000-0000000000a2');
select lives_ok($$ select public.send_message('f9300000-0000-0000-0000-0000000000d1', 'Hello') $$, 'and people can write again');
select pg_temp.as_user('f9000000-0000-0000-0000-0000000000c1');
select lives_ok($$ select public.decide_request((select id from public.engagements where athlete_id = 'f9000000-0000-0000-0000-0000000000a1' and status = 'requested'), true) $$,
  'and a coach can accept');
reset role;

select * from finish();
rollback;
