-- M4-08: messages between an athlete and a coach. Only the two people in a conversation read it.
begin;
select plan(11);

insert into auth.users (id, email, email_confirmed_at) values
  ('ac000000-0000-0000-0000-0000000000c1', 'ms-coach@t.test', now()),
  ('ac000000-0000-0000-0000-0000000000b1', 'ms-kabir@t.test', now()),
  ('ac000000-0000-0000-0000-0000000000b2', 'ms-neha@t.test', now());
insert into public.user_roles (user_id, role) values ('ac000000-0000-0000-0000-0000000000c1', 'coach');
insert into public.coach_profiles (coach_id, headline, status, agreement_version) values
  ('ac000000-0000-0000-0000-0000000000c1', 'Boxing', 'live', public.current_coach_agreement());
insert into public.engagements (id, athlete_id, coach_id, package_title, package_kind, price_paise, fee_bps, start_date, days_per_week)
  values ('ad000000-0000-0000-0000-0000000000e1', 'ac000000-0000-0000-0000-0000000000b1', 'ac000000-0000-0000-0000-0000000000c1', 'Online coaching', 'monthly', 450000, 1500, current_date, 3);

create temp table ids (name text primary key, id uuid);
grant all on ids to authenticated;
create function pg_temp.as_user(uid text) returns void language sql as $$ select set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated"}', uid), true) $$;
set local role authenticated;

-- Kabir has a request with the coach, so they can talk; Neha has none.
select pg_temp.as_user('ac000000-0000-0000-0000-0000000000b1');
insert into ids select 'c', public.open_conversation('ad000000-0000-0000-0000-0000000000e1');
select is(public.open_conversation('ad000000-0000-0000-0000-0000000000e1'), (select id from ids where name = 'c'), 'one conversation per pair');
select lives_ok(format($$ select public.send_message(%L, 'Hi Vikram. Old left knee injury.') $$, (select id from ids where name = 'c')), 'the athlete writes');
select throws_ok(format($$ select public.send_message(%L, '   ') $$, (select id from ids where name = 'c')), '22023', 'bad_message', 'an empty message is refused');
select throws_ok(format($$ select public.send_message(%L, repeat('x', 2001)) $$, (select id from ids where name = 'c')), '22023', 'bad_message', 'so is one over 2,000 characters');
select throws_ok(format($$ insert into public.messages (conversation_id, sender_id, body) values (%L, 'ac000000-0000-0000-0000-0000000000b1', 'x') $$, (select id from ids where name = 'c')),
  '42501', null, 'no direct writes');

select pg_temp.as_user('ac000000-0000-0000-0000-0000000000c1');
select lives_ok(format($$ select public.send_message(%L, 'Happy to take you on.') $$, (select id from ids where name = 'c')), 'the coach replies');
select is((select string_agg(body, ' | ' order by id) from public.messages), 'Hi Vikram. Old left knee injury. | Happy to take you on.', 'both read the conversation');

select pg_temp.as_user('ac000000-0000-0000-0000-0000000000b2');
select is((select count(*)::int from public.messages), 0, 'a third person reads no messages');
select is((select count(*)::int from public.conversations), 0, 'nor the conversation');
select throws_ok($$ select public.open_conversation('ad000000-0000-0000-0000-0000000000e1') $$, '42501', 'no_engagement', 'only the two people in an engagement can open its conversation');

select pg_temp.as_user('ac000000-0000-0000-0000-0000000000b1');
select is((select jsonb_array_length(public.export_my_data() -> 'messages')), 1, 'the messages a person sent are in their data download');

select * from finish();
rollback;
