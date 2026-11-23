-- Renewal by a new Order each month (docs/plans/remaining-tasks-plan.md, Decision 1). An active monthly engagement
-- with no subscription opens a renewal order from 5 days before paid_through to the end of a 3-day grace. A paid
-- renewal extends paid_through once, with one payment and one payout; any other paid renewal is money owed back.
-- Reminders go 5 days and 1 day before; after the grace the coaching lapses as unpaid.
begin;
select plan(20);

insert into auth.users (id, email, email_confirmed_at) values
  ('7e000000-0000-0000-0000-0000000000c1', 'ro-coach@t.test', now()),
  ('7e000000-0000-0000-0000-0000000000a1', 'ro-due@t.test', now()),
  ('7e000000-0000-0000-0000-0000000000a2', 'ro-early@t.test', now()),
  ('7e000000-0000-0000-0000-0000000000a3', 'ro-sub@t.test', now()),
  ('7e000000-0000-0000-0000-0000000000a4', 'ro-grace@t.test', now()),
  ('7e000000-0000-0000-0000-0000000000a5', 'ro-late@t.test', now()),
  ('7e000000-0000-0000-0000-0000000000a6', 'ro-cancelling@t.test', now());
insert into public.user_roles (user_id, role) values ('7e000000-0000-0000-0000-0000000000c1', 'coach');
insert into public.coach_profiles (coach_id, headline, status, agreement_version) values
  ('7e000000-0000-0000-0000-0000000000c1', 'Boxing', 'live', public.current_coach_agreement());
update public.payment_settings set fake_allowed = true;
-- due: 3 days left. early: 10 days left. sub: renews by subscription. grace: 2 days past. late: 4 days past.
-- cancelling: cancelled, 3 days left.
insert into public.engagements (id, athlete_id, coach_id, package_title, package_kind, price_paise, fee_bps, start_date, days_per_week, status, share_data, paid_through) values
  ('7f000000-0000-0000-0000-0000000000e1', '7e000000-0000-0000-0000-0000000000a1', '7e000000-0000-0000-0000-0000000000c1', 'Online coaching', 'monthly', 450000, 1500, public.india_today() - 27, 3, 'active', true, public.india_today() + 3),
  ('7f000000-0000-0000-0000-0000000000e2', '7e000000-0000-0000-0000-0000000000a2', '7e000000-0000-0000-0000-0000000000c1', 'Online coaching', 'monthly', 450000, 1500, public.india_today() - 20, 3, 'active', true, public.india_today() + 10),
  ('7f000000-0000-0000-0000-0000000000e3', '7e000000-0000-0000-0000-0000000000a3', '7e000000-0000-0000-0000-0000000000c1', 'Online coaching', 'monthly', 450000, 1500, public.india_today() - 27, 3, 'active', true, public.india_today() + 3),
  ('7f000000-0000-0000-0000-0000000000e4', '7e000000-0000-0000-0000-0000000000a4', '7e000000-0000-0000-0000-0000000000c1', 'Online coaching', 'monthly', 450000, 1500, public.india_today() - 32, 3, 'active', true, public.india_today() - 2),
  ('7f000000-0000-0000-0000-0000000000e5', '7e000000-0000-0000-0000-0000000000a5', '7e000000-0000-0000-0000-0000000000c1', 'Online coaching', 'monthly', 450000, 1500, public.india_today() - 34, 3, 'active', true, public.india_today() - 4),
  ('7f000000-0000-0000-0000-0000000000e6', '7e000000-0000-0000-0000-0000000000a6', '7e000000-0000-0000-0000-0000000000c1', 'Online coaching', 'monthly', 450000, 1500, public.india_today() - 27, 3, 'cancelling', true, public.india_today() + 3);
insert into public.subscriptions (engagement_id, provider_subscription_id, status) values ('7f000000-0000-0000-0000-0000000000e3', 'sub_ro', 'active');

create function pg_temp.capture(event text, provider_order text, payment text, amount bigint default 450000) returns text language sql as $$
  select public.apply_payment_event(event, 'payment.captured', jsonb_build_object('event', 'payment.captured', 'payload',
    jsonb_build_object('payment', jsonb_build_object('entity', jsonb_build_object('id', payment, 'order_id', provider_order, 'amount', amount, 'currency', 'INR', 'status', 'captured')))));
$$;

-- Opening a renewal order (service role, as the pay action does).
select is((select kind || '|' || period_start || '|' || period_end || '|' || amount_paise from public.orders
  where id = (select order_id from public.start_renewal_checkout('7f000000-0000-0000-0000-0000000000e1', '7e000000-0000-0000-0000-0000000000a1'))),
  'renewal|' || (public.india_today() + 4) || '|' || public.month_period_end(public.india_today() + 4) || '|450000',
  'the renewal order covers the next month, from the day after the paid date, at the agreed price');
select is((select count(*)::int from public.orders where engagement_id = '7f000000-0000-0000-0000-0000000000e1' and kind = 'renewal'), 1, 'one order so far');
select lives_ok($$ select public.start_renewal_checkout('7f000000-0000-0000-0000-0000000000e1', '7e000000-0000-0000-0000-0000000000a1') $$, 'a second click');
select is((select count(*)::int from public.orders where engagement_id = '7f000000-0000-0000-0000-0000000000e1' and kind = 'renewal'), 1, 'reuses the open order');
select throws_ok($$ select public.start_renewal_checkout('7f000000-0000-0000-0000-0000000000e2', '7e000000-0000-0000-0000-0000000000a2') $$, '22023', 'not_due', 'more than 5 days before the paid date is too early');
select throws_ok($$ select public.start_renewal_checkout('7f000000-0000-0000-0000-0000000000e3', '7e000000-0000-0000-0000-0000000000a3') $$, '22023', 'not_payable', 'a subscription renews itself');
select throws_ok($$ select public.start_renewal_checkout('7f000000-0000-0000-0000-0000000000e6', '7e000000-0000-0000-0000-0000000000a6') $$, '22023', 'not_payable', 'cancelled coaching does not renew');
select throws_ok($$ select public.start_renewal_checkout('7f000000-0000-0000-0000-0000000000e1', '7e000000-0000-0000-0000-0000000000a2') $$, '22023', 'not_payable', 'only the athlete pays');
select lives_ok($$ select public.start_renewal_checkout('7f000000-0000-0000-0000-0000000000e4', '7e000000-0000-0000-0000-0000000000a4') $$, 'in the 3-day grace the athlete can still pay');
select throws_ok($$ select public.start_renewal_checkout('7f000000-0000-0000-0000-0000000000e5', '7e000000-0000-0000-0000-0000000000a5') $$, '22023', 'not_payable', 'after the grace it cannot');

-- Paying the renewal.
update public.orders set provider_order_id = 'fake_ro1' where engagement_id = '7f000000-0000-0000-0000-0000000000e1' and kind = 'renewal';
select is(pg_temp.capture('evt_ro1', 'fake_ro1', 'pay_ro1'), 'applied', 'the renewal payment is applied');
select is((select paid_through from public.engagements where id = '7f000000-0000-0000-0000-0000000000e1'), public.month_period_end(public.india_today() + 4), 'paid_through moves to the end of the new month');
select is((select count(*)::int from public.payments p join public.orders o on o.id = p.order_id where o.engagement_id = '7f000000-0000-0000-0000-0000000000e1' and p.status = 'captured'), 1, 'one captured payment');
select is((select net_paise from public.payouts u join public.payments p on p.id = u.payment_id where p.provider_payment_id = 'pay_ro1'), 382500::bigint, 'one payout for the coach, net of the fee');
select is((select count(*)::int from public.email_outbox where template = 'coaching_renewed' and data ->> 'engagement' = '7f000000-0000-0000-0000-0000000000e1'), 2, 'both people hear about the renewal');
select is(pg_temp.capture('evt_ro2', 'fake_ro1', 'pay_ro2'), 'applied', 'a second capture of the same order is recorded');
select is((select status from public.payments where provider_payment_id = 'pay_ro2'), 'duplicate', 'as money owed back, with no second month');

-- The daily sweep: reminders, grace and lapse.
update public.engagements set paid_through = public.india_today() + 5 where id = '7f000000-0000-0000-0000-0000000000e2';
select public.sweep_engagements();
select public.sweep_engagements();
select is((select count(*)::int from public.email_outbox where template = 'renewal_due' and data ->> 'engagement' = '7f000000-0000-0000-0000-0000000000e2'), 1, 'a reminder 5 days before, once, to the athlete only');
select is((select string_agg(status, ',' order by id) from public.engagements where id in ('7f000000-0000-0000-0000-0000000000e4', '7f000000-0000-0000-0000-0000000000e5')),
  'active,lapsed', 'the grace keeps 2 days past due active; 4 days past due lapses');
select is((select public.engagement_opens(g) from public.engagements g where id = '7f000000-0000-0000-0000-0000000000e4'), true, 'the coach keeps access during the grace');

select * from finish();
rollback;
