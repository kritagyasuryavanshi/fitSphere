-- M4-09a: the payment core. Checkout takes the amount from the engagement only; apply_payment_event is the one writer
-- of money state; duplicates, wrong amounts, unknown orders and late payments never change what they should not, and
-- money owed back is always flagged.
begin;
select plan(36);

insert into auth.users (id, email, email_confirmed_at) values
  ('b1000000-0000-0000-0000-0000000000c1', 'pay-coach@t.test', now()),
  ('b1000000-0000-0000-0000-0000000000a1', 'pay-kabir@t.test', now()),
  ('b1000000-0000-0000-0000-0000000000a2', 'pay-neha@t.test', now()),
  ('b1000000-0000-0000-0000-0000000000a3', 'pay-ravi@t.test', now());
insert into public.user_roles (user_id, role) values ('b1000000-0000-0000-0000-0000000000c1', 'coach');
insert into public.coach_profiles (coach_id, headline, status, agreement_version) values
  ('b1000000-0000-0000-0000-0000000000c1', 'Boxing', 'live', public.current_coach_agreement());
-- Kabir's request was accepted and started 5 days ago; Neha's is still waiting; Ravi's was accepted.
insert into public.engagements (id, athlete_id, coach_id, package_title, package_kind, price_paise, fee_bps, start_date, days_per_week, status) values
  ('b2000000-0000-0000-0000-0000000000e1', 'b1000000-0000-0000-0000-0000000000a1', 'b1000000-0000-0000-0000-0000000000c1', 'Online coaching', 'monthly', 450000, 1500, public.india_today() - 5, 3, 'accepted'),
  ('b2000000-0000-0000-0000-0000000000e2', 'b1000000-0000-0000-0000-0000000000a2', 'b1000000-0000-0000-0000-0000000000c1', 'Online coaching', 'monthly', 450000, 1500, public.india_today(), 3, 'requested'),
  ('b2000000-0000-0000-0000-0000000000e3', 'b1000000-0000-0000-0000-0000000000a3', 'b1000000-0000-0000-0000-0000000000c1', 'Online coaching', 'monthly', 450000, 1500, public.india_today(), 3, 'accepted');

create temp table ids (name text primary key, id uuid);
grant all on ids to authenticated, service_role;
create function pg_temp.captured(event text, provider_order text, payment text, amount bigint) returns text language sql as $$
  select public.apply_payment_event(event, 'payment.captured', jsonb_build_object('event', 'payment.captured', 'payload',
    jsonb_build_object('payment', jsonb_build_object('entity', jsonb_build_object('id', payment, 'order_id', provider_order, 'amount', amount, 'currency', 'INR', 'status', 'captured')))));
$$;

-- The fee, in whole paise, rounded half up.
select is(public.fee_paise(450000, 1500::smallint), 67500::bigint, '15% of ₹4,500 is ₹675');
select is(public.fee_paise(10, 1500::smallint), 2::bigint, 'exactly half a paisa (1.5) rounds up');
select is(public.fee_paise(330, 1500::smallint), 50::bigint, '49.5 rounds up to 50');
select is(public.fee_paise(3, 1500::smallint), 0::bigint, 'below half (0.45) rounds down');
-- A month runs to the day before the same date next month, or to the end of a shorter next month.
select is(public.month_period_end('2027-01-15'), '2027-02-14'::date, 'mid-month: to the day before the same date');
select is(public.month_period_end('2027-01-31'), '2027-02-28'::date, 'the 31st: to the end of February, not the 27th');
select is(public.month_period_end('2027-03-31'), '2027-04-30'::date, 'and to the end of April');

-- Only the server (service role) starts checkout.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"b1000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
select throws_ok($$ select public.start_checkout('b2000000-0000-0000-0000-0000000000e1', 'b1000000-0000-0000-0000-0000000000a1') $$, '42501', null,
  'a signed-in person cannot call start_checkout');
reset role;
set local role service_role;

insert into ids select 'o1', order_id from public.start_checkout('b2000000-0000-0000-0000-0000000000e1', 'b1000000-0000-0000-0000-0000000000a1');
select is((select row(amount_paise, fee_bps, kind, status)::text from public.orders where id = (select id from ids where name = 'o1')),
  row(450000::bigint, 1500::smallint, 'first', 'created')::text, 'the order takes the amount and fee from the engagement');
-- Checkout opened again on a later day still reuses the one open order: no second order to pay.
reset role;
update public.orders set period_start = period_start - 1 where id = (select id from ids where name = 'o1');
set local role service_role;
select is((select order_id from public.start_checkout('b2000000-0000-0000-0000-0000000000e1', 'b1000000-0000-0000-0000-0000000000a1')), (select id from ids where name = 'o1'),
  'starting again, on any day, reuses the open order');
select throws_ok($$ select public.start_checkout('b2000000-0000-0000-0000-0000000000e2', 'b1000000-0000-0000-0000-0000000000a2') $$, '22023', 'not_payable',
  'a request the coach has not accepted cannot be paid');
select throws_ok($$ select public.start_checkout('b2000000-0000-0000-0000-0000000000e1', 'b1000000-0000-0000-0000-0000000000a2') $$, '22023', 'not_payable',
  'nor someone else''s');
select is(public.attach_provider_order((select id from ids where name = 'o1'), 'fake_order_1'), 'fake_order_1', 'the provider order is attached');
select is(public.attach_provider_order((select id from ids where name = 'o1'), 'fake_order_other'), 'fake_order_1',
  'a second attach (a double click) keeps the first and returns it');

-- A wrong amount, or an unknown order, changes nothing and is flagged.
select is(pg_temp.captured('evt_bad', 'fake_order_1', 'pay_bad', 100), 'ignored', 'a capture for the wrong amount is ignored');
select is((select status from public.orders where id = (select id from ids where name = 'o1')), 'created', 'and the order stays unpaid');
select is(pg_temp.captured('evt_unknown', 'fake_order_nope', 'pay_x', 450000), 'ignored', 'a capture for an unknown order is ignored');

-- The real capture: coaching runs a month from the day the money arrives (Kabir's start date has passed).
select is(pg_temp.captured('evt_1', 'fake_order_1', 'pay_1', 450000), 'applied', 'the capture applies');
select is((select status || ':' || paid_through from public.engagements where id = 'b2000000-0000-0000-0000-0000000000e1'),
  'active:' || public.month_period_end(public.india_today()), 'coaching is active for a month from today');
select is((select period_start from public.orders where id = (select id from ids where name = 'o1')), public.india_today(), 'the order records that period');
select is((select row(gross_paise, fee_paise, net_paise, status)::text from public.payouts), row(450000::bigint, 67500::bigint, 382500::bigint, 'manual_due')::text,
  'a payout for the coach: the price less the 15% fee');
select ok((select hold_until between now() + interval '7 days' - interval '1 minute' and now() + interval '7 days' from public.payouts), 'held for 7 days');
select is(pg_temp.captured('evt_1', 'fake_order_1', 'pay_1', 450000), 'duplicate', 'the same event again is a duplicate');
select is(pg_temp.captured('evt_2', 'fake_order_1', 'pay_2', 450000), 'applied', 'a second capture on a paid order is recorded');
select is((select status from public.payments where provider_payment_id = 'pay_2'), 'duplicate', 'as money owed back');
select is((select count(*)::int from public.payouts), 1, 'with no second payout');

-- Ravi pays after withdrawing: the money is owed back and nothing starts.
insert into ids select 'o3', order_id from public.start_checkout('b2000000-0000-0000-0000-0000000000e3', 'b1000000-0000-0000-0000-0000000000a3');
select public.attach_provider_order((select id from ids where name = 'o3'), 'fake_order_3');
reset role;
update public.engagements set status = 'withdrawn' where id = 'b2000000-0000-0000-0000-0000000000e3';
set local role service_role;
select is(pg_temp.captured('evt_3', 'fake_order_3', 'pay_3', 450000), 'applied', 'a payment after a withdrawal is recorded');
select is((select status from public.payments where provider_payment_id = 'pay_3'), 'duplicate', 'as money owed back');
select is((select status from public.engagements where id = 'b2000000-0000-0000-0000-0000000000e3'), 'withdrawn', 'and coaching does not start');

-- Every unresolved case is flagged: two owed back, two ignored captures.
select is((select string_agg(rule, ' | ' order by rule) from public.money_invariants()),
  'capture event ignored | capture event ignored | payment owed back to the athlete | payment owed back to the athlete', 'money owed back or unmatched is flagged');

-- Fake payments only where the database allows them (the seed allows them locally; production never does).
reset role;
update public.payment_settings set fake_allowed = false;
set local role service_role;
select is(pg_temp.captured('evt_fake_off', 'fake_order_1', 'pay_9', 450000), 'ignored', 'with fake payments off, a fake capture is ignored');
select is((select note from public.payment_events where provider_event_id = 'evt_fake_off'), 'fake payments are off', 'and says why');

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
