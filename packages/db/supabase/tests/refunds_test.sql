-- M4-12: refunds and payout reversal. The athlete refunds a first payment within the owner's terms, an admin refunds
-- by hand, and money owed back is refunded by the daily cron. The provider's refund events, applied by the one writer
-- of money state, end the coaching, reverse the payout and log each step. See docs/plans/m4-12-refunds.md.
begin;
select plan(76);

update public.payment_settings set fake_allowed = false;
insert into auth.users (id, email, email_confirmed_at) values
  ('f3000000-0000-0000-0000-0000000000c1', 'rf-vikram@t.test', now()),
  ('f3000000-0000-0000-0000-0000000000d1', 'rf-admin@t.test', now()),
  ('f3000000-0000-0000-0000-0000000000a1', 'rf-kabir@t.test', now()),
  ('f3000000-0000-0000-0000-0000000000a2', 'rf-neha@t.test', now()),
  ('f3000000-0000-0000-0000-0000000000a3', 'rf-ravi@t.test', now()),
  ('f3000000-0000-0000-0000-0000000000a4', 'rf-isha@t.test', now()),
  ('f3000000-0000-0000-0000-0000000000a5', 'rf-arjun@t.test', now()),
  ('f3000000-0000-0000-0000-0000000000a6', 'rf-meera@t.test', now()),
  ('f3000000-0000-0000-0000-0000000000a7', 'rf-dev@t.test', now()),
  ('f3000000-0000-0000-0000-0000000000a8', 'rf-tara@t.test', now());
insert into public.user_roles (user_id, role) values ('f3000000-0000-0000-0000-0000000000c1', 'coach'), ('f3000000-0000-0000-0000-0000000000d1', 'admin');
update public.profiles set display_name = 'Vikram' where id = 'f3000000-0000-0000-0000-0000000000c1';
update public.profiles set display_name = 'Kabir' where id = 'f3000000-0000-0000-0000-0000000000a1';
insert into public.coach_profiles (coach_id, headline, status, agreement_version) values
  ('f3000000-0000-0000-0000-0000000000c1', 'Boxing', 'live', public.current_coach_agreement());

-- Kabir: monthly, first paid 2 days ago, renewing. Neha: monthly, first paid 10 days ago. Ravi: a session in 5 days.
-- Isha: a session tomorrow. Arjun: monthly, plus a second charge owed back. Meera: monthly, renewed 3 days ago.
-- Dev: monthly, first paid yesterday.
insert into public.engagements (id, athlete_id, coach_id, package_title, package_kind, price_paise, fee_bps, start_date, days_per_week, status, share_data, paid_through) values
  ('f4000000-0000-0000-0000-0000000000e1', 'f3000000-0000-0000-0000-0000000000a1', 'f3000000-0000-0000-0000-0000000000c1', 'Online coaching', 'monthly', 450000, 1500, public.india_today() - 2, 3, 'active', true, public.month_period_end(public.india_today() - 2)),
  ('f4000000-0000-0000-0000-0000000000e2', 'f3000000-0000-0000-0000-0000000000a2', 'f3000000-0000-0000-0000-0000000000c1', 'Online coaching', 'monthly', 450000, 1500, public.india_today() - 10, 3, 'active', true, public.month_period_end(public.india_today() - 10)),
  ('f4000000-0000-0000-0000-0000000000e3', 'f3000000-0000-0000-0000-0000000000a3', 'f3000000-0000-0000-0000-0000000000c1', 'Form check', 'single', 120000, 1500, public.india_today() + 5, 3, 'active', true, public.india_today() + 5),
  ('f4000000-0000-0000-0000-0000000000e4', 'f3000000-0000-0000-0000-0000000000a4', 'f3000000-0000-0000-0000-0000000000c1', 'Form check', 'single', 120000, 1500, public.india_today() + 1, 3, 'active', true, public.india_today() + 1),
  ('f4000000-0000-0000-0000-0000000000e5', 'f3000000-0000-0000-0000-0000000000a5', 'f3000000-0000-0000-0000-0000000000c1', 'Online coaching', 'monthly', 450000, 1500, public.india_today() - 40, 3, 'active', true, public.india_today() + 20),
  ('f4000000-0000-0000-0000-0000000000e6', 'f3000000-0000-0000-0000-0000000000a6', 'f3000000-0000-0000-0000-0000000000c1', 'Online coaching', 'monthly', 450000, 1500, public.india_today() - 33, 3, 'active', true, public.month_period_end(public.india_today() - 3)),
  ('f4000000-0000-0000-0000-0000000000e7', 'f3000000-0000-0000-0000-0000000000a7', 'f3000000-0000-0000-0000-0000000000c1', 'Online coaching', 'monthly', 450000, 1500, public.india_today() - 1, 3, 'active', true, public.month_period_end(public.india_today() - 1));
insert into public.orders (id, engagement_id, amount_paise, fee_bps, kind, period_start, period_end, provider_order_id, status, paid_at) values
  ('f5000000-0000-0000-0000-0000000000e1', 'f4000000-0000-0000-0000-0000000000e1', 450000, 1500, 'first', public.india_today() - 2, public.month_period_end(public.india_today() - 2), 'order_k1', 'paid', now() - interval '2 days'),
  ('f5000000-0000-0000-0000-0000000000e2', 'f4000000-0000-0000-0000-0000000000e2', 450000, 1500, 'first', public.india_today() - 10, public.month_period_end(public.india_today() - 10), 'order_n1', 'paid', now() - interval '10 days'),
  ('f5000000-0000-0000-0000-0000000000e3', 'f4000000-0000-0000-0000-0000000000e3', 120000, 1500, 'first', public.india_today() + 5, public.india_today() + 5, 'order_r1', 'paid', now() - interval '1 day'),
  ('f5000000-0000-0000-0000-0000000000e4', 'f4000000-0000-0000-0000-0000000000e4', 120000, 1500, 'first', public.india_today() + 1, public.india_today() + 1, 'order_i1', 'paid', now() - interval '1 day'),
  ('f5000000-0000-0000-0000-0000000000e5', 'f4000000-0000-0000-0000-0000000000e5', 450000, 1500, 'first', public.india_today() - 40, public.india_today() - 11, 'order_a1', 'paid', now() - interval '40 days'),
  ('f5000000-0000-0000-0000-0000000000f5', 'f4000000-0000-0000-0000-0000000000e5', 450000, 1500, 'renewal', public.india_today() - 10, public.india_today() - 10, null, 'failed', null),
  ('f5000000-0000-0000-0000-0000000000e6', 'f4000000-0000-0000-0000-0000000000e6', 450000, 1500, 'first', public.india_today() - 33, public.india_today() - 4, 'order_m1', 'paid', now() - interval '33 days'),
  ('f5000000-0000-0000-0000-0000000000f6', 'f4000000-0000-0000-0000-0000000000e6', 450000, 1500, 'renewal', public.india_today() - 3, public.month_period_end(public.india_today() - 3), null, 'paid', now() - interval '3 days'),
  ('f5000000-0000-0000-0000-0000000000e7', 'f4000000-0000-0000-0000-0000000000e7', 450000, 1500, 'first', public.india_today() - 1, public.month_period_end(public.india_today() - 1), 'order_d1', 'paid', now() - interval '1 day');
insert into public.payments (id, order_id, provider_payment_id, amount_paise, currency, status, captured_at) values
  ('f6000000-0000-0000-0000-0000000000e1', 'f5000000-0000-0000-0000-0000000000e1', 'pay_k1', 450000, 'INR', 'captured', now() - interval '2 days'),
  ('f6000000-0000-0000-0000-0000000000e2', 'f5000000-0000-0000-0000-0000000000e2', 'pay_n1', 450000, 'INR', 'captured', now() - interval '10 days'),
  ('f6000000-0000-0000-0000-0000000000e3', 'f5000000-0000-0000-0000-0000000000e3', 'pay_r1', 120000, 'INR', 'captured', now() - interval '1 day'),
  ('f6000000-0000-0000-0000-0000000000e4', 'f5000000-0000-0000-0000-0000000000e4', 'pay_i1', 120000, 'INR', 'captured', now() - interval '1 day'),
  ('f6000000-0000-0000-0000-0000000000e5', 'f5000000-0000-0000-0000-0000000000e5', 'pay_a1', 450000, 'INR', 'captured', now() - interval '40 days'),
  ('f6000000-0000-0000-0000-0000000000f5', 'f5000000-0000-0000-0000-0000000000f5', 'pay_a2', 450000, 'INR', 'duplicate', now() - interval '10 days'),
  ('f6000000-0000-0000-0000-0000000000e6', 'f5000000-0000-0000-0000-0000000000e6', 'pay_m1', 450000, 'INR', 'captured', now() - interval '33 days'),
  ('f6000000-0000-0000-0000-0000000000f6', 'f5000000-0000-0000-0000-0000000000f6', 'pay_m2', 450000, 'INR', 'captured', now() - interval '3 days'),
  ('f6000000-0000-0000-0000-0000000000e7', 'f5000000-0000-0000-0000-0000000000e7', 'pay_d1', 450000, 'INR', 'captured', now() - interval '1 day');
insert into public.payouts (payment_id, coach_id, gross_paise, fee_paise, net_paise, hold_until, status)
select p.id, 'f3000000-0000-0000-0000-0000000000c1', p.amount_paise, public.fee_paise(p.amount_paise, 1500::smallint),
  p.amount_paise - public.fee_paise(p.amount_paise, 1500::smallint), p.captured_at + interval '7 days',
  case when p.provider_payment_id = 'pay_n1' then 'manual_paid' else 'manual_due' end
from public.payments p where p.status = 'captured' and p.provider_payment_id like 'pay\_%' and p.id::text like 'f6%';
insert into public.subscriptions (engagement_id, provider_subscription_id, status) values
  ('f4000000-0000-0000-0000-0000000000e1', 'sub_kabir', 'active'),
  ('f4000000-0000-0000-0000-0000000000e6', 'sub_meera', 'active');

create function pg_temp.refund_event(event text, type_ text, refund text, payment text, amount bigint default 450000) returns text language sql as $$
  select public.apply_payment_event(event, type_, jsonb_build_object('event', type_, 'payload', jsonb_build_object('refund',
    jsonb_build_object('entity', jsonb_build_object('id', refund, 'payment_id', payment, 'amount', amount, 'currency', 'INR')))));
$$;
create function pg_temp.as_user(uid text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;
create function pg_temp.emails(template_ text, engagement uuid) returns int language sql as $$
  select count(*)::int from public.email_outbox where template = template_ and data ->> 'engagement' = engagement::text;
$$;
create function pg_temp.refund_of(payment text) returns public.refunds language sql as $$
  select r.* from public.refunds r join public.payments p on p.id = r.payment_id where p.provider_payment_id = payment order by r.status = 'failed', r.created_at desc limit 1;
$$;
grant execute on all functions in schema pg_temp to authenticated, service_role, anon;

-- The terms: the athlete's own first payment, within 7 days for coaching, 2 or more days before a session.
set local role authenticated;
select pg_temp.as_user('f3000000-0000-0000-0000-0000000000a1');
select is(public.refund_quote('f4000000-0000-0000-0000-0000000000e1'), 450000::bigint, 'coaching paid 2 days ago is refundable in full');
select is(public.refund_quote('f4000000-0000-0000-0000-0000000000e2'), null, 'nobody sees a refund for someone else''s coaching');
select pg_temp.as_user('f3000000-0000-0000-0000-0000000000a2');
select is(public.refund_quote('f4000000-0000-0000-0000-0000000000e2'), null, 'coaching paid 10 days ago is past the 7-day window');
select throws_ok($$ select * from public.request_refund('f4000000-0000-0000-0000-0000000000e2') $$, '22023', 'not_refundable', 'and the request is refused');
select pg_temp.as_user('f3000000-0000-0000-0000-0000000000a3');
select is(public.refund_quote('f4000000-0000-0000-0000-0000000000e3'), 120000::bigint, 'a session in 5 days is refundable');
select pg_temp.as_user('f3000000-0000-0000-0000-0000000000a4');
select is(public.refund_quote('f4000000-0000-0000-0000-0000000000e4'), null, 'a session tomorrow is not');
select pg_temp.as_user('f3000000-0000-0000-0000-0000000000a6');
select is(public.refund_quote('f4000000-0000-0000-0000-0000000000e6'), null, 'a renewed month is not refundable');
select pg_temp.as_user('f3000000-0000-0000-0000-0000000000a1');
select throws_ok($$ select * from public.request_refund('f4000000-0000-0000-0000-0000000000e3') $$, '42501', 'not_yours', 'nobody refunds someone else''s payment');
select throws_ok($$ select * from public.attach_provider_refund(gen_random_uuid(), 'rfnd_x') $$, '42501', null, 'a signed-in person cannot attach a provider refund');
select throws_ok($$ select * from public.queue_owed_back_refunds() $$, '42501', null, 'nor queue refunds');
select throws_ok($$ select * from public.refunds_to_send(0) $$, '42501', null, 'nor list refunds to send');
select throws_ok($$ select * from public.admin_refund('f6000000-0000-0000-0000-0000000000f6', 'x') $$, '42501', 'not_admin', 'nor refund by hand unless an admin');
reset role;
set local role anon;
select throws_ok($$ select * from public.request_refund('f4000000-0000-0000-0000-0000000000e1') $$, '42501', null, 'a signed-out caller cannot request a refund');
reset role;

-- Kabir asks for his refund.
set local role authenticated;
select pg_temp.as_user('f3000000-0000-0000-0000-0000000000a1');
select is((select row(provider_payment_id, amount_paise)::text from public.request_refund('f4000000-0000-0000-0000-0000000000e1')),
  row('pay_k1', 450000::bigint)::text, 'the request returns the payment to refund, in full');
select throws_ok($$ select * from public.request_refund('f4000000-0000-0000-0000-0000000000e1') $$, '22023', 'not_refundable', 'a second request is refused');
select is(public.refund_quote('f4000000-0000-0000-0000-0000000000e1'), null, 'and no second refund is offered');
select is((select count(*)::int from public.refunds), 1, 'the athlete reads their own refund');
reset role;
select is((select row(r.reason, r.status, r.requested_by, r.amount_paise)::text from pg_temp.refund_of('pay_k1') r),
  row('first_payment', 'requested', 'f3000000-0000-0000-0000-0000000000a1'::uuid, 450000::bigint)::text, 'the refund is requested by the athlete');
select is((select count(*)::int from public.audit_log where action = 'refund_requested' and details ->> 'refund' = (pg_temp.refund_of('pay_k1')).id::text), 1, 'the request is logged');
select is((select status from public.engagements where id = 'f4000000-0000-0000-0000-0000000000e1'), 'active', 'coaching runs until the provider confirms the refund');
select is(public.attach_provider_refund((pg_temp.refund_of('pay_k1')).id, 'rfnd_k1'), 'rfnd_k1', 'the server attaches the provider''s refund');
select is(public.attach_provider_refund((pg_temp.refund_of('pay_k1')).id, 'rfnd_k1b'), 'rfnd_k1', 'a second attach keeps the first');

-- The provider confirms it.
select is(pg_temp.refund_event('evt_k0', 'refund.processed', 'rfnd_k1', 'pay_k1', 100), 'ignored', 'a partial refund is ignored');
select is(pg_temp.refund_event('evt_k1', 'refund.processed', 'rfnd_k1', 'pay_k1'), 'applied', 'the processed refund is applied');
select is((select row(r.status, r.processed_at is not null)::text from pg_temp.refund_of('pay_k1') r), row('processed', true)::text, 'the refund is processed');
select is((select status from public.payments where provider_payment_id = 'pay_k1'), 'refunded', 'the payment is refunded');
select is((select status from public.orders where id = 'f5000000-0000-0000-0000-0000000000e1'), 'refunded', 'so is its order');
select is((select u.status from public.payouts u join public.payments p on p.id = u.payment_id where p.provider_payment_id = 'pay_k1'), 'reversed', 'the coach''s payout is reversed');
select is((select row(status, ended_at is not null)::text from public.engagements where id = 'f4000000-0000-0000-0000-0000000000e1'), row('refunded', true)::text, 'the coaching is refunded and ended');
set local role authenticated;
select pg_temp.as_user('f3000000-0000-0000-0000-0000000000c1');
select ok(not public.coach_can_read('f3000000-0000-0000-0000-0000000000a1'), 'the coach loses access at once');
reset role;
select is(pg_temp.emails('coaching_refunded', 'f4000000-0000-0000-0000-0000000000e1'), 2, 'the athlete and the coach get an email');
select is((select count(*)::int from public.notifications where user_id = 'f3000000-0000-0000-0000-0000000000a1' and kind = 'refund_processed'), 1, 'the athlete is notified');
select is((select count(*)::int from public.audit_log where action = 'refund_processed' and details ->> 'refund' = (pg_temp.refund_of('pay_k1')).id::text), 1, 'the refund is logged');
select ok(exists (select 1 from public.subscriptions_to_stop() where provider_subscription_id = 'sub_kabir'), 'the subscription is stopped next');
select is((select count(*)::int from public.money_invariants() where ref in ('f4000000-0000-0000-0000-0000000000e1', 'f5000000-0000-0000-0000-0000000000e1', 'f6000000-0000-0000-0000-0000000000e1', (pg_temp.refund_of('pay_k1')).id)), 0,
  'the refund breaks no money rule');
select is(pg_temp.refund_event('evt_k1', 'refund.processed', 'rfnd_k1', 'pay_k1'), 'duplicate', 'the same event again is a duplicate');
select is(pg_temp.refund_event('evt_k2', 'refund.processed', 'rfnd_k1', 'pay_k1'), 'ignored', 'the same refund in a new event is ignored');
select is(pg_temp.refund_event('evt_c1', 'refund.created', 'rfnd_k1', 'pay_k1'), 'ignored', 'an event type with nothing to do is ignored');
select is((select count(*)::int from public.money_invariants() where rule = 'refund event ignored'), 1, 'and raises no alert; only the partial refund does');
select is(pg_temp.refund_event('evt_u1', 'refund.processed', 'rfnd_u1', 'pay_unknown'), 'ignored', 'a refund of an unknown payment is ignored');
select is(pg_temp.refund_event('evt_f1', 'refund.processed', 'fake_rfnd_1', 'pay_r1', 120000), 'ignored', 'a fake refund is ignored while fake payments are off');

-- A session refund.
set local role authenticated;
select pg_temp.as_user('f3000000-0000-0000-0000-0000000000a3');
select is((select amount_paise from public.request_refund('f4000000-0000-0000-0000-0000000000e3')), 120000::bigint, 'the session is refunded in full');
reset role;
-- The provider's event can arrive before the server attaches its id: it is matched by the payment.
select is(pg_temp.refund_event('evt_r1', 'refund.processed', 'rfnd_r1', 'pay_r1', 120000), 'applied', 'an event before the attach is matched by the payment');
select is((select row(r.provider_refund_id, r.status)::text from pg_temp.refund_of('pay_r1') r), row('rfnd_r1', 'processed')::text, 'and records the provider''s id');
select is((select status from public.engagements where id = 'f4000000-0000-0000-0000-0000000000e3'), 'refunded', 'the session is refunded');

-- Money owed back is refunded by the cron, whatever the renewal rule says.
select is((select count(*)::int from public.queue_owed_back_refunds() where provider_payment_id = 'pay_a2'), 1, 'the cron queues a refund for the payment owed back, and sends it in the same run');
select is((select count(*)::int from public.queue_owed_back_refunds()), 0, 'only once');
select is((select row(r.reason, r.requested_by)::text from pg_temp.refund_of('pay_a2') r), row('owed_back', null::uuid)::text, 'a refund nobody asked for');
select ok(exists (select 1 from public.refunds_to_send(0) where provider_payment_id = 'pay_a2'), 'it waits to be sent');
select ok(not exists (select 1 from public.refunds_to_send(10) where provider_payment_id = 'pay_a2'), 'a refund the server may still be sending waits 10 minutes');
select is(pg_temp.refund_event('evt_a2', 'refund.processed', 'rfnd_a2', 'pay_a2'), 'applied', 'the refund of money owed back is applied');
select is((select status from public.payments where provider_payment_id = 'pay_a2'), 'refunded', 'the payment is refunded');
select is((select status from public.engagements where id = 'f4000000-0000-0000-0000-0000000000e5'), 'active', 'the coaching it was owed back from runs on');
select ok(not exists (select 1 from public.money_invariants() where ref = 'f6000000-0000-0000-0000-0000000000f5'), 'nothing is owed back any more');

-- An admin refunds the first month of coaching already renewed: the paid month runs on.
set local role authenticated;
select pg_temp.as_user('f3000000-0000-0000-0000-0000000000d1');
select is((select amount_paise from public.admin_refund('f6000000-0000-0000-0000-0000000000e6', 'Goodwill')), 450000::bigint, 'an admin refunds a first month by hand');
reset role;
select is(pg_temp.refund_event('evt_m1', 'refund.processed', 'rfnd_m1', 'pay_m1'), 'applied', 'that refund is applied');
select is((select status from public.engagements where id = 'f4000000-0000-0000-0000-0000000000e6'), 'active', 'the renewed month the athlete paid for runs on');
select ok(not exists (select 1 from public.money_invariants() where ref = 'f4000000-0000-0000-0000-0000000000e6'), 'and breaks no money rule');

-- An admin refunds a renewed month: the coaching ends, and the earlier month still counts.
set local role authenticated;
select pg_temp.as_user('f3000000-0000-0000-0000-0000000000d1');
select is((select amount_paise from public.admin_refund('f6000000-0000-0000-0000-0000000000f6', 'Coach did not show up')), 450000::bigint, 'an admin refunds a renewal by hand');
reset role;
select is((select row(r.reason, r.requested_by, r.note)::text from pg_temp.refund_of('pay_m2') r),
  row('admin', 'f3000000-0000-0000-0000-0000000000d1'::uuid, 'Coach did not show up')::text, 'the refund names the admin and the reason');
select is(pg_temp.refund_event('evt_m2', 'refund.processed', 'rfnd_m2', 'pay_m2'), 'applied', 'the renewal refund is applied');
select is((select row(status, paid_through)::text from public.engagements where id = 'f4000000-0000-0000-0000-0000000000e6'),
  row('ended', public.india_today() - 4)::text, 'the coaching ends, paid to the end of the month before');
select is(pg_temp.emails('coaching_ended', 'f4000000-0000-0000-0000-0000000000e6'), 2, 'both get an email');

-- A failed refund is flagged, and can be asked for again.
set local role authenticated;
select pg_temp.as_user('f3000000-0000-0000-0000-0000000000a7');
select lives_ok($$ select * from public.request_refund('f4000000-0000-0000-0000-0000000000e7') $$, 'Dev asks for a refund');
reset role;
select is(pg_temp.refund_event('evt_d1', 'refund.failed', 'rfnd_d1', 'pay_d1'), 'applied', 'the provider reports it failed');
select ok(exists (select 1 from public.money_invariants() where rule = 'refund failed' and ref = (pg_temp.refund_of('pay_d1')).id), 'a failed refund is flagged');
set local role authenticated;
select pg_temp.as_user('f3000000-0000-0000-0000-0000000000a7');
select is(public.refund_quote('f4000000-0000-0000-0000-0000000000e7'), 450000::bigint, 'and the athlete can ask again');
reset role;
-- A second refund of one payment under another provider id is ignored, never an error the provider retries forever.
set local role authenticated;
select pg_temp.as_user('f3000000-0000-0000-0000-0000000000a7');
select lives_ok($$ select * from public.request_refund('f4000000-0000-0000-0000-0000000000e7') $$, 'Dev asks again');
reset role;
select is(public.attach_provider_refund((pg_temp.refund_of('pay_d1')).id, 'rfnd_d2'), 'rfnd_d2', 'the new refund is attached');
select is(pg_temp.refund_event('evt_d3', 'refund.processed', 'rfnd_d3', 'pay_d1'), 'ignored', 'a different refund of the same payment is ignored');
select is((select row(r.provider_refund_id, r.status)::text from pg_temp.refund_of('pay_d1') r), row('rfnd_d2', 'requested')::text, 'and the requested refund is untouched');

-- A session paid for well ahead: the coach's payout waits until the session can no longer be refunded.
insert into public.engagements (id, athlete_id, coach_id, package_title, package_kind, price_paise, fee_bps, start_date, days_per_week, status, share_data) values
  ('f4000000-0000-0000-0000-0000000000e8', 'f3000000-0000-0000-0000-0000000000a8', 'f3000000-0000-0000-0000-0000000000c1', 'Form check', 'single', 120000, 1500, public.india_today() + 20, 3, 'accepted', true);
insert into public.orders (engagement_id, amount_paise, fee_bps, period_start, period_end, provider_order_id) values
  ('f4000000-0000-0000-0000-0000000000e8', 120000, 1500, public.india_today() + 20, public.india_today() + 20, 'order_t1');
select is(public.apply_payment_event('evt_t1', 'payment.captured', jsonb_build_object('event', 'payment.captured', 'payload', jsonb_build_object('payment',
  jsonb_build_object('entity', jsonb_build_object('id', 'pay_t1', 'order_id', 'order_t1', 'amount', 120000, 'currency', 'INR'))))), 'applied', 'Tara pays for a session in 20 days');
select is((select u.hold_until from public.payouts u join public.payments p on p.id = u.payment_id where p.provider_payment_id = 'pay_t1'),
  ((public.india_today() + 19)::timestamp at time zone 'Asia/Kolkata'), 'the payout is held to the day before the session, when refunds close');

-- A refund made at the provider's dashboard is recorded too; a payout already paid to the coach is flagged.
select is(pg_temp.refund_event('evt_n1', 'refund.processed', 'rfnd_n1', 'pay_n1'), 'applied', 'a refund made at the provider is applied');
select is((select row(r.reason, r.status)::text from pg_temp.refund_of('pay_n1') r), row('admin', 'processed')::text, 'and recorded as an admin refund');
select ok(exists (select 1 from public.money_invariants() where rule = 'refund after the coach was paid'), 'the coach was already paid, so an admin must recover it');

select * from finish();
rollback;
