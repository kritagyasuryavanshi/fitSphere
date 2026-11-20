-- M4-09a: the payment core. Checkout takes the amount from the engagement only; apply_payment_event is the one writer
-- of money state; duplicates, wrong amounts and unknown orders never change anything they should not.
begin;
select plan(26);

insert into auth.users (id, email, email_confirmed_at) values
  ('b1000000-0000-0000-0000-0000000000c1', 'pay-coach@t.test', now()),
  ('b1000000-0000-0000-0000-0000000000a1', 'pay-kabir@t.test', now()),
  ('b1000000-0000-0000-0000-0000000000a2', 'pay-neha@t.test', now());
insert into public.user_roles (user_id, role) values ('b1000000-0000-0000-0000-0000000000c1', 'coach');
insert into public.coach_profiles (coach_id, headline, status, agreement_version) values
  ('b1000000-0000-0000-0000-0000000000c1', 'Boxing', 'live', public.current_coach_agreement());
-- Kabir's request was accepted; Neha's is still waiting.
insert into public.engagements (id, athlete_id, coach_id, package_title, package_kind, price_paise, fee_bps, start_date, days_per_week, status) values
  ('b2000000-0000-0000-0000-0000000000e1', 'b1000000-0000-0000-0000-0000000000a1', 'b1000000-0000-0000-0000-0000000000c1', 'Online coaching', 'monthly', 450000, 1500, public.india_today(), 3, 'accepted'),
  ('b2000000-0000-0000-0000-0000000000e2', 'b1000000-0000-0000-0000-0000000000a2', 'b1000000-0000-0000-0000-0000000000c1', 'Online coaching', 'monthly', 450000, 1500, public.india_today(), 3, 'requested');

create temp table ids (name text primary key, id uuid);
grant all on ids to authenticated, service_role;
create function pg_temp.captured(event text, provider_order text, payment text, amount bigint) returns text language sql as $$
  select public.apply_payment_event(event, 'payment.captured', jsonb_build_object('event', 'payment.captured', 'payload',
    jsonb_build_object('payment', jsonb_build_object('entity', jsonb_build_object('id', payment, 'order_id', provider_order, 'amount', amount, 'currency', 'INR', 'status', 'captured')))));
$$;

-- The fee, in whole paise, rounded half up.
select is(public.fee_paise(450000, 1500::smallint), 67500::bigint, '15% of ₹4,500 is ₹675');
select is(public.fee_paise(10, 1500::smallint), 2::bigint, 'half a paisa rounds up');
select is(public.fee_paise(333, 1500::smallint), 50::bigint, 'below half rounds down');

-- Only the server (service role) starts checkout.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"b1000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
select throws_ok($$ select public.start_checkout('b2000000-0000-0000-0000-0000000000e1', 'b1000000-0000-0000-0000-0000000000a1') $$, '42501', null,
  'a signed-in person cannot call start_checkout');
reset role;
set local role service_role;

insert into ids select 'o1', order_id from public.start_checkout('b2000000-0000-0000-0000-0000000000e1', 'b1000000-0000-0000-0000-0000000000a1');
select is((select row(amount_paise, fee_bps, period_start, period_end, status)::text from public.orders where id = (select id from ids where name = 'o1')),
  row(450000::bigint, 1500::smallint, public.india_today(), (public.india_today() + interval '1 month' - interval '1 day')::date, 'created')::text,
  'the order takes the amount and fee from the engagement, for one month from the start');
select is((select order_id from public.start_checkout('b2000000-0000-0000-0000-0000000000e1', 'b1000000-0000-0000-0000-0000000000a1')), (select id from ids where name = 'o1'),
  'starting again reuses the open order');
select throws_ok($$ select public.start_checkout('b2000000-0000-0000-0000-0000000000e2', 'b1000000-0000-0000-0000-0000000000a2') $$, '22023', 'not_payable',
  'a request the coach has not accepted cannot be paid');
select throws_ok($$ select public.start_checkout('b2000000-0000-0000-0000-0000000000e1', 'b1000000-0000-0000-0000-0000000000a2') $$, '22023', 'not_payable',
  'nor someone else''s');
select public.attach_provider_order((select id from ids where name = 'o1'), 'fake_order_1');
select throws_ok($$ select public.attach_provider_order((select id from ids where name = 'o1'), 'fake_order_other') $$, '22023', 'already_attached',
  'a provider order is attached once');

-- A wrong amount changes nothing.
select is(pg_temp.captured('evt_bad', 'fake_order_1', 'pay_bad', 100), 'ignored', 'a capture for the wrong amount is ignored');
select is((select status from public.orders where id = (select id from ids where name = 'o1')), 'created', 'and the order stays unpaid');
select is((select note from public.payment_events where provider_event_id = 'evt_bad'), 'amount or currency does not match the order', 'with the reason kept');
select is(pg_temp.captured('evt_unknown', 'fake_order_nope', 'pay_x', 450000), 'ignored', 'a capture for an unknown order is ignored');

-- The real capture.
select is(pg_temp.captured('evt_1', 'fake_order_1', 'pay_1', 450000), 'applied', 'the capture applies');
select is((select status || ':' || paid_through from public.engagements where id = 'b2000000-0000-0000-0000-0000000000e1'),
  'active:' || (public.india_today() + interval '1 month' - interval '1 day')::date, 'coaching is active, paid through the end of the month');
select is((select row(gross_paise, fee_paise, net_paise, status)::text from public.payouts), row(450000::bigint, 67500::bigint, 382500::bigint, 'manual_due')::text,
  'a payout for the coach: the price less the 15% fee');
select ok((select hold_until between now() + interval '7 days' - interval '1 minute' and now() + interval '7 days' from public.payouts), 'held for 7 days');
select is(pg_temp.captured('evt_1', 'fake_order_1', 'pay_1', 450000), 'duplicate', 'the same event again is a duplicate');
select is(pg_temp.captured('evt_2', 'fake_order_1', 'pay_2', 450000), 'applied', 'a second capture on a paid order is recorded');
select is((select string_agg(status, ',' order by status) from public.payments), 'captured,duplicate', 'as a duplicate payment, so it can be refunded');
select is((select count(*)::int from public.payouts), 1, 'with no second payout');
select is((select count(*)::int from public.money_invariants()), 0, 'the money rules hold');

-- Who reads what.
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"b1000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
select is((select count(*)::int from public.orders) + (select count(*)::int from public.payments), 3, 'the athlete reads their order and payments');
select is((select count(*)::int from public.payouts), 0, 'but not the coach''s payout');
select is((select count(*)::int from public.notifications where kind = 'payment_received'), 1, 'and gets a receipt notification');
select set_config('request.jwt.claims', '{"sub":"b1000000-0000-0000-0000-0000000000a2","role":"authenticated"}', true);
select is((select count(*)::int from public.orders) + (select count(*)::int from public.payments) + (select count(*)::int from public.payouts), 0,
  'someone else reads none of it');

select * from finish();
rollback;
