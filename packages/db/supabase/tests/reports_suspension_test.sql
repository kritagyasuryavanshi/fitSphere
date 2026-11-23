-- M4-18: reports, the admin queue and suspension (docs/plans/remaining-tasks-plan.md). Anyone reports a review, a
-- message or a coach; one open report per reporter and target. An admin reads a reported message with up to 5
-- messages on each side, every read logged; hides a review; suspends a coach. Suspension ends the coach's running
-- coaching at once and refunds the unused days pro rata: the only partial refund. Its payout is cut by the same
-- share, or recorded as a coach debt when already paid.
begin;
select plan(26);

insert into auth.users (id, email, email_confirmed_at) values
  ('8a000000-0000-0000-0000-0000000000c1', 'rp-coach@t.test', now()),
  ('8a000000-0000-0000-0000-0000000000a1', 'rp-kabir@t.test', now()),
  ('8a000000-0000-0000-0000-0000000000a2', 'rp-neha@t.test', now()),
  ('8a000000-0000-0000-0000-0000000000a3', 'rp-stranger@t.test', now()),
  ('8a000000-0000-0000-0000-0000000000ad', 'rp-admin@t.test', now());
insert into public.user_roles (user_id, role) values ('8a000000-0000-0000-0000-0000000000c1', 'coach'), ('8a000000-0000-0000-0000-0000000000ad', 'admin');
insert into public.coach_profiles (coach_id, headline, status, agreement_version) values
  ('8a000000-0000-0000-0000-0000000000c1', 'Boxing', 'live', public.current_coach_agreement());
update public.app_settings set marketplace_open = true;
update public.payment_settings set fake_allowed = true;
-- Kabir: a 30-day month, 10 days used, 20 left, payout still due. Neha: same, payout already paid.
insert into public.engagements (id, athlete_id, coach_id, package_title, package_kind, price_paise, fee_bps, start_date, days_per_week, status, share_data, paid_through) values
  ('8b000000-0000-0000-0000-0000000000e1', '8a000000-0000-0000-0000-0000000000a1', '8a000000-0000-0000-0000-0000000000c1', 'Online coaching', 'monthly', 300000, 1500, public.india_today() - 9, 3, 'active', true, public.india_today() + 20),
  ('8b000000-0000-0000-0000-0000000000e2', '8a000000-0000-0000-0000-0000000000a2', '8a000000-0000-0000-0000-0000000000c1', 'Online coaching', 'monthly', 300000, 1500, public.india_today() - 9, 3, 'active', true, public.india_today() + 20);
insert into public.orders (id, engagement_id, amount_paise, fee_bps, kind, period_start, period_end, provider_order_id, status, paid_at) values
  ('8c000000-0000-0000-0000-000000000001', '8b000000-0000-0000-0000-0000000000e1', 300000, 1500, 'first', public.india_today() - 9, public.india_today() + 20, 'order_rp1', 'paid', now() - interval '9 days'),
  ('8c000000-0000-0000-0000-000000000002', '8b000000-0000-0000-0000-0000000000e2', 300000, 1500, 'first', public.india_today() - 9, public.india_today() + 20, 'order_rp2', 'paid', now() - interval '9 days');
insert into public.payments (id, order_id, provider_payment_id, amount_paise, currency, status, captured_at) values
  ('8d000000-0000-0000-0000-000000000001', '8c000000-0000-0000-0000-000000000001', 'pay_rp1', 300000, 'INR', 'captured', now() - interval '9 days'),
  ('8d000000-0000-0000-0000-000000000002', '8c000000-0000-0000-0000-000000000002', 'pay_rp2', 300000, 'INR', 'captured', now() - interval '9 days');
insert into public.payouts (id, payment_id, coach_id, gross_paise, fee_paise, net_paise, hold_until, status) values
  ('8e000000-0000-0000-0000-000000000001', '8d000000-0000-0000-0000-000000000001', '8a000000-0000-0000-0000-0000000000c1', 300000, 45000, 255000, now() - interval '2 days', 'manual_due'),
  ('8e000000-0000-0000-0000-000000000002', '8d000000-0000-0000-0000-000000000002', '8a000000-0000-0000-0000-0000000000c1', 300000, 45000, 255000, now() - interval '2 days', 'manual_paid');
-- A conversation with 12 messages; the 7th is reported.
insert into public.conversations (id, athlete_id, coach_id) values ('8f000000-0000-0000-0000-000000000001', '8a000000-0000-0000-0000-0000000000a1', '8a000000-0000-0000-0000-0000000000c1');
insert into public.messages (conversation_id, sender_id, body, created_at)
  select '8f000000-0000-0000-0000-000000000001', '8a000000-0000-0000-0000-0000000000c1', 'message ' || n, now() - make_interval(mins => 20 - n) from generate_series(1, 12) n;

create function pg_temp.as_user(uid text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;
create function pg_temp.refund_event(event text, refund text, payment text, amount bigint) returns text language sql as $$
  select public.apply_payment_event(event, 'refund.processed', jsonb_build_object('event', 'refund.processed', 'payload',
    jsonb_build_object('refund', jsonb_build_object('entity', jsonb_build_object('id', refund, 'payment_id', payment, 'amount', amount, 'currency', 'INR')))));
$$;
create temp table rep (id uuid);
grant all on rep to authenticated;
set local role authenticated;

-- Reporting.
select pg_temp.as_user('8a000000-0000-0000-0000-0000000000a3');
select throws_ok($$ select public.report_content('message', (select id from public.messages where body = 'message 7')::text, 'abuse') $$, '42501', 'not_yours', 'only someone in the chat reports a message');
select pg_temp.as_user('8a000000-0000-0000-0000-0000000000a1');
select throws_ok($$ select public.report_content('message', (select id from public.messages where body = 'message 7')::text, 'because') $$, '22023', 'bad_reason', 'the reason is one of the listed ones');
insert into rep select public.report_content('message', (select id from public.messages where body = 'message 7')::text, 'harassment');
select is((select count(*)::int from rep), 1, 'the athlete reports a message');
select lives_ok($$ select public.report_content('message', (select id from public.messages where body = 'message 7')::text, 'harassment') $$, 'reporting it again');
select is((select count(*)::int from public.reports where status = 'open'), 1, 'keeps one open report per reporter and target');
select lives_ok($$ select public.report_content('coach', '8a000000-0000-0000-0000-0000000000c1', 'unsafe_advice') $$, 'a coach can be reported');
select throws_ok($$ select * from public.admin_reports() $$, '42501', null, 'only admins see the queue');

-- The admin queue and the message context.
select pg_temp.as_user('8a000000-0000-0000-0000-0000000000ad');
select is((select count(*)::int from public.admin_reports()), 2, 'the admin sees both open reports');
select is((select string_agg(body, ',' order by created_at) from public.admin_report_context((select id from rep))),
  'message 2,message 3,message 4,message 5,message 6,message 7,message 8,message 9,message 10,message 11,message 12', 'the reported message with up to 5 on each side');
select is((select count(*)::int from public.audit_log where action = 'report_context_read' and target_id = (select id from rep)), 1, 'the read is logged');
select lives_ok($$ select public.admin_resolve_report((select id from rep), 'dismissed') $$, 'the admin dismisses a report');
select is((select status from public.reports where id = (select id from rep)), 'dismissed', 'it leaves the queue');

-- Suspension: ends the coaching now and refunds the unused 20 of 30 days.
select lives_ok($$ select public.admin_suspend_coach('8a000000-0000-0000-0000-0000000000c1', 'Unsafe advice to clients') $$, 'the admin suspends the coach');
select is((select status from public.coach_profiles where coach_id = '8a000000-0000-0000-0000-0000000000c1'), 'suspended', 'the coach is suspended');
select is((select string_agg(status || '|' || paid_through, ',' order by id) from public.engagements where coach_id = '8a000000-0000-0000-0000-0000000000c1'),
  'ended|' || public.india_today() || ',ended|' || public.india_today(), 'both clients'' coaching ends today');
select is((select amount_paise from public.refunds where payment_id = '8d000000-0000-0000-0000-000000000001'), 200000::bigint, 'Kabir gets 20 of 30 days back: Rs 2,000');
select is((select reason || '|' || status from public.refunds where payment_id = '8d000000-0000-0000-0000-000000000001'), 'suspension|requested', 'a suspension refund, sent by the cron');
select is((select count(*)::int from public.reports where status = 'open' and target_kind = 'coach'), 0, 'the coach report is resolved by the suspension');

-- The provider confirms the partial refunds.
reset role;
select is(pg_temp.refund_event('evt_rp1', 'rfnd_rp1', 'pay_rp1', 200000), 'applied', 'the partial refund is applied');
select is((select status from public.payments where id = '8d000000-0000-0000-0000-000000000001'), 'captured', 'the payment stays captured: only part came back');
select is((select gross_paise || '|' || fee_paise || '|' || net_paise from public.payouts where id = '8e000000-0000-0000-0000-000000000001'),
  '100000|15000|85000', 'the unpaid payout is cut by the same share');
select is(pg_temp.refund_event('evt_rp2', 'rfnd_rp2', 'pay_rp2', 200000), 'applied', 'Neha''s partial refund is applied');
select is((select amount_paise from public.coach_debts where payout_id = '8e000000-0000-0000-0000-000000000002'), 170000::bigint,
  'a payout already paid becomes a coach debt of the net share');
select is(pg_temp.refund_event('evt_rp3', 'rfnd_rp3', 'pay_rp1', 300000), 'ignored', 'a refund for more than was asked is ignored');
select is_empty($$ select * from public.money_invariants() where rule not in ('refund waiting over a day', 'refund event ignored') $$, 'the money rules still hold (the wrong-amount event above is rightly flagged)');

-- Lifting the suspension.
set local role authenticated;
select pg_temp.as_user('8a000000-0000-0000-0000-0000000000ad');
select lives_ok($$ select public.admin_unsuspend_coach('8a000000-0000-0000-0000-0000000000c1') $$, 'the admin lifts the suspension');

select * from finish();
rollback;
