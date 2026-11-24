-- M4-17: booking a single 1:1 session (docs/plans/remaining-tasks-plan.md). The athlete of an accepted single-session
-- request holds a time for 15 minutes: at least 48 hours ahead, inside one weekly window of the coach (India time),
-- for the package's length, never overlapping another live booking. Checkout needs the hold; paying confirms it. A
-- payment for a slot lost meanwhile is money owed back. A booked session is refundable until 24 hours before it.
begin;
select plan(21);

insert into auth.users (id, email, email_confirmed_at) values
  ('6a000000-0000-0000-0000-0000000000c1', 'bk-coach@t.test', now()),
  ('6a000000-0000-0000-0000-0000000000a1', 'bk-kabir@t.test', now()),
  ('6a000000-0000-0000-0000-0000000000a2', 'bk-neha@t.test', now());
insert into public.user_roles (user_id, role) values ('6a000000-0000-0000-0000-0000000000c1', 'coach');
insert into public.coach_profiles (coach_id, headline, status, agreement_version) values
  ('6a000000-0000-0000-0000-0000000000c1', 'Boxing', 'live', public.current_coach_agreement());
update public.app_settings set marketplace_open = true;
update public.payment_settings set fake_allowed = true;
insert into public.packages (id, coach_id, title, kind, price_paise, live, minutes) values
  ('6b000000-0000-0000-0000-000000000001', '6a000000-0000-0000-0000-0000000000c1', 'Form check', 'single', 120000, true, 60);
-- Every day of the week, 07:00 to 09:00 India time.
insert into public.availability_slots (coach_id, dow, start_time, minutes) select '6a000000-0000-0000-0000-0000000000c1', d, '07:00', 120 from generate_series(1, 7) d;
insert into public.engagements (id, athlete_id, coach_id, package_id, package_title, package_kind, price_paise, fee_bps, start_date, days_per_week, status, share_data) values
  ('6c000000-0000-0000-0000-0000000000e1', '6a000000-0000-0000-0000-0000000000a1', '6a000000-0000-0000-0000-0000000000c1', '6b000000-0000-0000-0000-000000000001', 'Form check', 'single', 120000, 1500, public.india_today() + 5, 3, 'accepted', true),
  ('6c000000-0000-0000-0000-0000000000e2', '6a000000-0000-0000-0000-0000000000a2', '6a000000-0000-0000-0000-0000000000c1', '6b000000-0000-0000-0000-000000000001', 'Form check', 'single', 120000, 1500, public.india_today() + 5, 3, 'accepted', true);

create function pg_temp.as_user(uid text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;
-- An India-time instant N days from today at hh:mm.
create function pg_temp.at(days int, hhmm text) returns timestamptz language sql as $$
  select ((public.india_today() + days)::text || ' ' || hhmm)::timestamp at time zone 'Asia/Kolkata';
$$;
create function pg_temp.capture(event text, provider_order text, payment text) returns text language sql as $$
  select public.apply_payment_event(event, 'payment.captured', jsonb_build_object('event', 'payment.captured', 'payload',
    jsonb_build_object('payment', jsonb_build_object('entity', jsonb_build_object('id', payment, 'order_id', provider_order, 'amount', 120000, 'currency', 'INR')))));
$$;
grant execute on function pg_temp.at(int, text) to authenticated;
set local role authenticated;

-- Holding a time.
select pg_temp.as_user('6a000000-0000-0000-0000-0000000000a2');
select throws_ok($$ select public.reserve_slot('6c000000-0000-0000-0000-0000000000e1', pg_temp.at(5, '07:00')) $$, '42501', 'not_yours', 'only the athlete holds a time');
select pg_temp.as_user('6a000000-0000-0000-0000-0000000000a1');
select throws_ok($$ select public.reserve_slot('6c000000-0000-0000-0000-0000000000e1', now() + interval '1 day') $$, '22023', 'too_soon', 'less than 48 hours ahead is too soon');
select throws_ok($$ select public.reserve_slot('6c000000-0000-0000-0000-0000000000e1', pg_temp.at(5, '08:30')) $$, '22023', 'not_available', 'a session running past the window is refused');
select throws_ok($$ select public.reserve_slot('6c000000-0000-0000-0000-0000000000e1', pg_temp.at(5, '12:00')) $$, '22023', 'not_available', 'a time outside the windows is refused');
select lives_ok($$ select public.reserve_slot('6c000000-0000-0000-0000-0000000000e1', pg_temp.at(5, '07:00')) $$, 'Kabir holds 07:00 to 08:00');
select is((select ends_at - starts_at from public.bookings where engagement_id = '6c000000-0000-0000-0000-0000000000e1' and status = 'held'), interval '60 minutes', 'the hold lasts as long as the package');
select pg_temp.as_user('6a000000-0000-0000-0000-0000000000a2');
select throws_ok($$ select public.reserve_slot('6c000000-0000-0000-0000-0000000000e2', pg_temp.at(5, '07:30')) $$, '22023', 'slot_taken', 'an overlapping time is taken');
select lives_ok($$ select public.reserve_slot('6c000000-0000-0000-0000-0000000000e2', pg_temp.at(5, '08:00')) $$, 'the next hour is free');
select pg_temp.as_user('6a000000-0000-0000-0000-0000000000a1');
select lives_ok($$ select public.reserve_slot('6c000000-0000-0000-0000-0000000000e1', pg_temp.at(6, '07:00')) $$, 'picking again replaces the hold');
select is((select count(*)::int from public.bookings where engagement_id = '6c000000-0000-0000-0000-0000000000e1' and status = 'held'), 1, 'one live hold per request');

-- Checkout and payment (service role, as the pay action does).
reset role;
select throws_ok($$ select public.start_checkout('6c000000-0000-0000-0000-0000000000e2', '6a000000-0000-0000-0000-0000000000a1') $$, '22023', 'not_payable', 'only the athlete pays');
update public.bookings set hold_expires_at = now() - interval '1 minute' where engagement_id = '6c000000-0000-0000-0000-0000000000e2';
select throws_ok($$ select public.start_checkout('6c000000-0000-0000-0000-0000000000e2', '6a000000-0000-0000-0000-0000000000a2') $$, '22023', 'needs_slot', 'an expired hold must be picked again');
create temp table o1 as select * from public.start_checkout('6c000000-0000-0000-0000-0000000000e1', '6a000000-0000-0000-0000-0000000000a1');
update public.orders set provider_order_id = 'order_bk1' where id = (select order_id from o1);
-- With the provider checkout open on a live hold, the time cannot change.
select pg_temp.as_user('6a000000-0000-0000-0000-0000000000a1');
set local role authenticated;
select throws_ok($$ select public.reserve_slot('6c000000-0000-0000-0000-0000000000e1', pg_temp.at(7, '07:00')) $$, '22023', 'checkout_open', 'the time is fixed while checkout is open');
reset role;
select is(pg_temp.capture('evt_bk1', 'order_bk1', 'pay_bk1'), 'applied', 'the session is paid');
select is((select status from public.bookings where engagement_id = '6c000000-0000-0000-0000-0000000000e1' and order_id = (select order_id from o1)), 'confirmed', 'paying confirms the hold');
select is((select status || '|' || paid_through from public.engagements where id = '6c000000-0000-0000-0000-0000000000e1'), 'active|' || (public.india_today() + 6), 'the coaching is active for the session date');
select is((select u.hold_until from public.payouts u join public.payments p on p.id = u.payment_id where p.provider_payment_id = 'pay_bk1'),
  greatest(now() + make_interval(days => public.payout_hold_days()), pg_temp.at(6, '07:00') - interval '24 hours'),
  'the payout waits for the usual hold, and never ends before refunds close 24 hours ahead');

-- A capture long after its hold ran out is money owed back, not a booking (Codex review).
insert into public.engagements (id, athlete_id, coach_id, package_id, package_title, package_kind, price_paise, fee_bps, start_date, days_per_week, status, share_data) values
  ('6c000000-0000-0000-0000-0000000000e3', '6a000000-0000-0000-0000-0000000000a2', '6a000000-0000-0000-0000-0000000000c1', '6b000000-0000-0000-0000-000000000001', 'Form check', 'single', 120000, 1500, public.india_today() + 9, 3, 'accepted', true);
insert into public.orders (id, engagement_id, amount_paise, fee_bps, period_start, period_end, provider_order_id) values
  ('6d000000-0000-0000-0000-000000000003', '6c000000-0000-0000-0000-0000000000e3', 120000, 1500, public.india_today() + 9, public.india_today() + 9, 'order_bk3');
insert into public.bookings (engagement_id, coach_id, athlete_id, starts_at, ends_at, hold_expires_at, order_id) values
  ('6c000000-0000-0000-0000-0000000000e3', '6a000000-0000-0000-0000-0000000000c1', '6a000000-0000-0000-0000-0000000000a2', pg_temp.at(9, '07:00'), pg_temp.at(9, '08:00'), now() - interval '1 hour', '6d000000-0000-0000-0000-000000000003');
select pg_temp.capture('evt_bk3', 'order_bk3', 'pay_bk3');
select is((select status from public.payments where provider_payment_id = 'pay_bk3'), 'duplicate', 'a capture an hour after the hold ran out is owed back');

-- Refunds: until 24 hours before the start.
select is(public.refundable_payment(g) is not null, true, 'a session 6 days away is refundable') from public.engagements g where id = '6c000000-0000-0000-0000-0000000000e1';
update public.bookings set starts_at = now() + interval '23 hours', ends_at = now() + interval '24 hours' where engagement_id = '6c000000-0000-0000-0000-0000000000e1' and status = 'confirmed';
select is(public.refundable_payment(g) is null, true, 'within 24 hours of the start it is not') from public.engagements g where id = '6c000000-0000-0000-0000-0000000000e1';

-- Ending the coaching frees the time.
update public.engagements set status = 'withdrawn' where id = '6c000000-0000-0000-0000-0000000000e2';
select is((select string_agg(status, ',') from public.bookings where engagement_id = '6c000000-0000-0000-0000-0000000000e2'), 'cancelled', 'a withdrawn request releases its hold');

select * from finish();
rollback;
