-- M6-07: caps on spammy writes. A signed-in person gets a fixed number of rows per window in each capped table,
-- whatever path writes them. The service role (crons, admin tools) is never capped.
begin;
select plan(6);

insert into auth.users (id, email, email_confirmed_at) values
  ('ca000000-0000-0000-0000-0000000000a1', 'cap-athlete@t.test', now()),
  ('ca000000-0000-0000-0000-0000000000c1', 'cap-coach@t.test', now());
update public.app_settings set marketplace_open = true;
insert into public.conversations (id, athlete_id, coach_id) values
  ('cb000000-0000-0000-0000-000000000001', 'ca000000-0000-0000-0000-0000000000a1', 'ca000000-0000-0000-0000-0000000000c1');

create function pg_temp.as_role(uid text, r text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', r)::text, true);
$$;

select pg_temp.as_role('ca000000-0000-0000-0000-0000000000a1', 'authenticated');
select lives_ok($$ insert into public.messages (conversation_id, sender_id, body)
  select 'cb000000-0000-0000-0000-000000000001', 'ca000000-0000-0000-0000-0000000000a1', 'hi ' || n from generate_series(1, 60) n $$,
  '60 messages in 10 minutes are fine');
select throws_ok($$ insert into public.messages (conversation_id, sender_id, body)
  values ('cb000000-0000-0000-0000-000000000001', 'ca000000-0000-0000-0000-0000000000a1', 'one more') $$,
  '22023', 'rate_limited', 'the 61st is refused');

select pg_temp.as_role('ca000000-0000-0000-0000-0000000000c1', 'authenticated');
select lives_ok($$ insert into public.messages (conversation_id, sender_id, body)
  values ('cb000000-0000-0000-0000-000000000001', 'ca000000-0000-0000-0000-0000000000c1', 'reply') $$,
  'the other person has their own count');

select pg_temp.as_role('ca000000-0000-0000-0000-0000000000a1', 'service_role');
select lives_ok($$ insert into public.messages (conversation_id, sender_id, body)
  values ('cb000000-0000-0000-0000-000000000001', 'ca000000-0000-0000-0000-0000000000a1', 'from a cron') $$,
  'the service role is not capped');

-- Rows older than the window stop counting.
update public.messages set created_at = now() - interval '11 minutes' where sender_id = 'ca000000-0000-0000-0000-0000000000a1';
select pg_temp.as_role('ca000000-0000-0000-0000-0000000000a1', 'authenticated');
select lives_ok($$ insert into public.messages (conversation_id, sender_id, body)
  values ('cb000000-0000-0000-0000-000000000001', 'ca000000-0000-0000-0000-0000000000a1', 'later') $$,
  'after the window the athlete can send again');

-- Every capped table has the trigger.
select is((select count(*)::int from pg_trigger where tgname = 'write_cap' and not tgisinternal), 8, 'eight tables are capped');

select * from finish();
rollback;
