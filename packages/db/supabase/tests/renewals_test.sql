-- M4-11a: monthly renewal, cancel and failed payments, with a fake subscription. A renewal charge adds the next month
-- through apply_payment_event; cancel keeps coaching to the end of the paid month; a failed renewal warns, then a halt
-- lapses the coaching; the daily sweep ends what has run out. Every change emails the athlete and the coach.
begin;
select plan(51);

insert into auth.users (id, email, email_confirmed_at) values
  ('f1000000-0000-0000-0000-0000000000c1', 'rn-vikram@t.test', now()),
  ('f1000000-0000-0000-0000-0000000000a1', 'rn-kabir@t.test', now()),
  ('f1000000-0000-0000-0000-0000000000a2', 'rn-neha@t.test', now()),
  ('f1000000-0000-0000-0000-0000000000a3', 'rn-ravi@t.test', now()),
  ('f1000000-0000-0000-0000-0000000000a4', 'rn-isha@t.test', now()),
  ('f1000000-0000-0000-0000-0000000000a5', 'rn-arjun@t.test', now()),
  ('f1000000-0000-0000-0000-0000000000a6', 'rn-meera@t.test', now());
insert into public.user_roles (user_id, role) values ('f1000000-0000-0000-0000-0000000000c1', 'coach');
update public.profiles set display_name = 'Vikram' where id = 'f1000000-0000-0000-0000-0000000000c1';
update public.profiles set display_name = 'Kabir' where id = 'f1000000-0000-0000-0000-0000000000a1';
insert into public.coach_profiles (coach_id, headline, status, agreement_version) values
  ('f1000000-0000-0000-0000-0000000000c1', 'Boxing', 'live', public.current_coach_agreement());
-- Kabir: monthly, paid to today, renewing. Neha: monthly, 10 days left, renewing. Ravi: a single session, run out.
-- Isha: cancelling, run out. Arjun: monthly, 8 days past due and the provider silent. Meera: monthly, run out, no
-- subscription to renew it.
insert into public.engagements (id, athlete_id, coach_id, package_title, package_kind, price_paise, fee_bps, start_date, days_per_week, status, share_data, paid_through) values
  ('f2000000-0000-0000-0000-0000000000e1', 'f1000000-0000-0000-0000-0000000000a1', 'f1000000-0000-0000-0000-0000000000c1', 'Online coaching', 'monthly', 450000, 1500, public.india_today() - 30, 3, 'active', true, public.india_today()),
  ('f2000000-0000-0000-0000-0000000000e2', 'f1000000-0000-0000-0000-0000000000a2', 'f1000000-0000-0000-0000-0000000000c1', 'Online coaching', 'monthly', 450000, 1500, public.india_today() - 20, 3, 'active', true, public.india_today() + 10),
  ('f2000000-0000-0000-0000-0000000000e3', 'f1000000-0000-0000-0000-0000000000a3', 'f1000000-0000-0000-0000-0000000000c1', 'Form check', 'single', 120000, 1500, public.india_today() - 1, 3, 'active', true, public.india_today() - 1),
  ('f2000000-0000-0000-0000-0000000000e4', 'f1000000-0000-0000-0000-0000000000a4', 'f1000000-0000-0000-0000-0000000000c1', 'Online coaching', 'monthly', 450000, 1500, public.india_today() - 31, 3, 'cancelling', true, public.india_today() - 1),
  ('f2000000-0000-0000-0000-0000000000e5', 'f1000000-0000-0000-0000-0000000000a5', 'f1000000-0000-0000-0000-0000000000c1', 'Online coaching', 'monthly', 450000, 1500, public.india_today() - 38, 3, 'active', true, public.india_today() - 8),
  ('f2000000-0000-0000-0000-0000000000e6', 'f1000000-0000-0000-0000-0000000000a6', 'f1000000-0000-0000-0000-0000000000c1', 'Online coaching', 'monthly', 450000, 1500, public.india_today() - 31, 3, 'active', true, public.india_today() - 1);
insert into public.subscriptions (engagement_id, provider_subscription_id, status) values
  ('f2000000-0000-0000-0000-0000000000e1', 'sub_kabir', 'active'),
  ('f2000000-0000-0000-0000-0000000000e2', 'sub_neha', 'active'),
  ('f2000000-0000-0000-0000-0000000000e5', 'sub_arjun', 'active');

create function pg_temp.emails(template_ text, engagement uuid) returns int language sql as $$
  select count(*)::int from public.email_outbox where template = template_ and data ->> 'engagement' = engagement::text;
$$;
create function pg_temp.sub_event(event text, type_ text, sub text, payment text default null, amount bigint default 450000) returns text language sql as $$
  select public.apply_payment_event(event, type_, jsonb_build_object('event', type_, 'payload',
    jsonb_build_object('subscription', jsonb_build_object('entity', jsonb_build_object('id', sub, 'status', 'active')))
    || case when payment is null then '{}'::jsonb else jsonb_build_object('payment', jsonb_build_object('entity',
      jsonb_build_object('id', payment, 'amount', amount, 'currency', 'INR', 'status', 'captured'))) end));
$$;
grant execute on all functions in schema pg_temp to authenticated, service_role;

-- Cancel: the athlete's own monthly coaching only.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"f1000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
select throws_ok($$ select public.cancel_coaching('f2000000-0000-0000-0000-0000000000e2', null) $$, '42501', 'not_yours', 'nobody cancels someone else''s coaching');
reset role;
set local role anon;
select throws_ok($$ select public.cancel_coaching('f2000000-0000-0000-0000-0000000000e2', null) $$, '42501', null, 'a signed-out caller cannot cancel anything');
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"f1000000-0000-0000-0000-0000000000a3","role":"authenticated"}', true);
select throws_ok($$ select public.cancel_coaching('f2000000-0000-0000-0000-0000000000e3', null) $$, '22023', 'not_cancellable', 'a single session has no renewal to cancel');
select set_config('request.jwt.claims', '{"sub":"f1000000-0000-0000-0000-0000000000a2","role":"authenticated"}', true);
select throws_ok($$ select public.cancel_coaching('f2000000-0000-0000-0000-0000000000e2', 'because') $$, '22023', 'bad_reason', 'the reason is one of the listed ones');
select is(public.cancel_coaching('f2000000-0000-0000-0000-0000000000e2', 'too_expensive'), public.india_today() + 10, 'cancel returns the last paid day');
reset role;
select is((select row(status, cancel_at_period_end, paid_through)::text from public.engagements where id = 'f2000000-0000-0000-0000-0000000000e2'),
  row('cancelling', true, public.india_today() + 10)::text, 'the coaching is cancelling, paid to the same day');
select is((select reason from public.cancel_reasons where engagement_id = 'f2000000-0000-0000-0000-0000000000e2'), 'too_expensive', 'the reason is kept apart');
select is(pg_temp.emails('coaching_cancelled', 'f2000000-0000-0000-0000-0000000000e2'), 2, 'the athlete and the coach get an email');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"f1000000-0000-0000-0000-0000000000a2","role":"authenticated"}', true);
select throws_ok($$ select public.cancel_coaching('f2000000-0000-0000-0000-0000000000e2', null) $$, '22023', 'not_cancellable', 'cancelling twice is refused');
select set_config('request.jwt.claims', '{"sub":"f1000000-0000-0000-0000-0000000000c1","role":"authenticated"}', true);
select ok(public.coach_can_read('f1000000-0000-0000-0000-0000000000a2'), 'the coach keeps access to the end of the paid month');
-- Only the server applies provider events, runs the sweep and attaches subscriptions.
select throws_ok($$ select pg_temp.sub_event('evt_x', 'subscription.halted', 'sub_kabir') $$, '42501', null, 'a signed-in person cannot apply provider events');
select throws_ok($$ select public.sweep_engagements() $$, '42501', null, 'nor run the sweep');
select throws_ok($$ select public.attach_subscription('f2000000-0000-0000-0000-0000000000e6', 'sub_x') $$, '42501', null, 'nor attach a subscription');
reset role;

-- A renewal charge adds the next month.
select is(pg_temp.sub_event('evt_r1', 'subscription.charged', 'sub_kabir', 'pay_r1'), 'applied', 'a renewal charge is applied');
select is((select paid_through from public.engagements where id = 'f2000000-0000-0000-0000-0000000000e1'), public.month_period_end(public.india_today() + 1),
  'the paid month moves on by one month, from the day after the last paid day');
select is((select row(kind, status, period_start, period_end, amount_paise)::text from public.orders where engagement_id = 'f2000000-0000-0000-0000-0000000000e1'),
  row('renewal', 'paid', public.india_today() + 1, public.month_period_end(public.india_today() + 1), 450000::bigint)::text, 'a paid renewal order records the month');
select is((select row(u.gross_paise, u.fee_paise, u.net_paise)::text from public.payouts u join public.payments p on p.id = u.payment_id where p.provider_payment_id = 'pay_r1'),
  row(450000::bigint, 67500::bigint, 382500::bigint)::text, 'the coach''s payout is the price less the fee');
select is(pg_temp.emails('coaching_renewed', 'f2000000-0000-0000-0000-0000000000e1'), 2, 'both get a renewal email');
select is((select count(*)::int from public.money_invariants() where ref in (select id from public.payments where provider_payment_id = 'pay_r1')), 0,
  'the renewal breaks no money rule');
select is(pg_temp.sub_event('evt_r1', 'subscription.charged', 'sub_kabir', 'pay_r1'), 'duplicate', 'the same event again is a duplicate');
select is(pg_temp.sub_event('evt_r1b', 'subscription.charged', 'sub_kabir', 'pay_r1'), 'ignored', 'the same payment in a new event is ignored');
select is(pg_temp.sub_event('evt_r2', 'subscription.charged', 'sub_kabir', 'pay_r2', 100), 'applied', 'a charge for the wrong amount is recorded');
select is((select status from public.payments where provider_payment_id = 'pay_r2'), 'duplicate', 'as money owed back');
select is((select paid_through from public.engagements where id = 'f2000000-0000-0000-0000-0000000000e1'), public.month_period_end(public.india_today() + 1),
  'and moves nothing');
select is(pg_temp.sub_event('evt_r3', 'subscription.charged', 'sub_kabir', 'pay_r3'), 'applied', 'a second charge in the same cycle is recorded');
select is((select row(p.status, o.status)::text from public.payments p join public.orders o on o.id = p.order_id where p.provider_payment_id = 'pay_r3'),
  row('duplicate', 'failed')::text, 'as money owed back: that month is not due yet');
select is((select count(*)::int from public.payouts u join public.payments p on p.id = u.payment_id where p.provider_payment_id in ('pay_r2', 'pay_r3')), 0,
  'and the coach is paid for neither');
select is(pg_temp.sub_event('evt_p0', 'subscription.pending', 'sub_kabir'), 'ignored', 'a failure notice after the renewal went through changes nothing');
select is((select status from public.subscriptions where provider_subscription_id = 'sub_kabir'), 'active', 'the subscription still renews');
select is(pg_temp.sub_event('evt_x1', 'subscription.charged', 'sub_nobody', 'pay_x1'), 'ignored', 'a charge on an unknown subscription is ignored');
select is(pg_temp.sub_event('evt_x2', 'subscription.charged', 'sub_kabir', 'pay_x2', 100000001), 'ignored', 'a charge too large to hold is ignored and flagged, not retried');
-- A charge after the athlete cancelled is money owed back, never another month.
select is(pg_temp.sub_event('evt_n1', 'subscription.charged', 'sub_neha', 'pay_n1'), 'applied', 'a charge after cancel is recorded');
select is((select status from public.payments where provider_payment_id = 'pay_n1'), 'duplicate', 'as money owed back');
select is((select paid_through from public.engagements where id = 'f2000000-0000-0000-0000-0000000000e2'), public.india_today() + 10, 'with no new month');

-- A failed renewal: the provider retries (pending), then gives up (halted) and the coaching lapses.
update public.engagements set paid_through = public.india_today() - 1 where id = 'f2000000-0000-0000-0000-0000000000e1';
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"f1000000-0000-0000-0000-0000000000c1","role":"authenticated"}', true);
select ok(public.coach_can_read('f1000000-0000-0000-0000-0000000000a1'), 'on renewal day the coach keeps access while the subscription renews');
reset role;
select is(pg_temp.sub_event('evt_p1', 'subscription.pending', 'sub_kabir'), 'applied', 'a failed renewal is applied');
select is((select status from public.subscriptions where provider_subscription_id = 'sub_kabir'), 'pending', 'the subscription waits for a retry');
select is(pg_temp.emails('renewal_failed', 'f2000000-0000-0000-0000-0000000000e1'), 2, 'both hear that the payment failed');
select is(pg_temp.sub_event('evt_h1', 'subscription.halted', 'sub_kabir'), 'applied', 'the provider gives up');
select is((select status from public.engagements where id = 'f2000000-0000-0000-0000-0000000000e1'), 'lapsed', 'and the coaching lapses');
select is(pg_temp.emails('coaching_lapsed', 'f2000000-0000-0000-0000-0000000000e1'), 2, 'both get an email');
select is(pg_temp.sub_event('evt_h2', 'subscription.halted', 'sub_kabir'), 'ignored', 'a second halt changes nothing');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"f1000000-0000-0000-0000-0000000000c1","role":"authenticated"}', true);
select ok(not public.coach_can_read('f1000000-0000-0000-0000-0000000000a1'), 'once the renewal fails, the grace ends');
reset role;
-- Subscriptions still renewing after their coaching stopped are handed to the server to cancel at the provider.
select is((select string_agg(provider_subscription_id, ',' order by provider_subscription_id) from public.subscriptions_to_stop()), 'sub_neha',
  'the cancelled coaching''s subscription is to stop');
select lives_ok($$ select public.mark_subscription_cancelled((select subscription_id from public.subscriptions_to_stop())) $$, 'the server marks it stopped');
select is((select count(*)::int from public.subscriptions_to_stop()), 0, 'and nothing is left to stop');
select is(pg_temp.sub_event('evt_c1', 'subscription.cancelled', 'sub_neha'), 'applied', 'the provider confirms a cancel');

-- The daily sweep ends what ran out: the single session, the cancelled month, the monthly coaching without a
-- subscription, and lapses the one whose provider went silent for a week.
select is(public.sweep_engagements(), 4, 'the sweep changes four engagements');
select is((select string_agg(status, ',' order by id) from public.engagements where id in ('f2000000-0000-0000-0000-0000000000e3',
  'f2000000-0000-0000-0000-0000000000e4', 'f2000000-0000-0000-0000-0000000000e5', 'f2000000-0000-0000-0000-0000000000e6', 'f2000000-0000-0000-0000-0000000000e2')),
  'cancelling,ended,ended,lapsed,ended', 'run-out coaching ends, a silent renewal lapses, and paid time is kept');
select is((select count(*)::int from public.email_outbox where template in ('coaching_ended', 'coaching_lapsed') and data ->> 'engagement' in
  ('f2000000-0000-0000-0000-0000000000e3', 'f2000000-0000-0000-0000-0000000000e4', 'f2000000-0000-0000-0000-0000000000e5', 'f2000000-0000-0000-0000-0000000000e6')), 8,
  'each change emails both');
select is(public.sweep_engagements(), 0, 'a second sweep changes nothing');

select * from finish();
rollback;
