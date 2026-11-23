-- M4-13 phase a: manual payouts (docs/plans/remaining-tasks-plan.md). An admin pays a coach by bank transfer only
-- after the hold, and only while no refund is asked or done; the check locks the payment row, as refunds do, so a
-- refund and a payout cannot cross. A failed transfer goes back to due. A coach sees only their own earnings.
begin;
select plan(16);

insert into auth.users (id, email, email_confirmed_at) values
  ('9a000000-0000-0000-0000-0000000000c1', 'po-coach@t.test', now()),
  ('9a000000-0000-0000-0000-0000000000c2', 'po-other@t.test', now()),
  ('9a000000-0000-0000-0000-0000000000a1', 'po-athlete@t.test', now()),
  ('9a000000-0000-0000-0000-0000000000ad', 'po-admin@t.test', now());
insert into public.user_roles (user_id, role) values ('9a000000-0000-0000-0000-0000000000c1', 'coach'), ('9a000000-0000-0000-0000-0000000000c2', 'coach'),
  ('9a000000-0000-0000-0000-0000000000ad', 'admin');
insert into public.coach_profiles (coach_id, headline, status, agreement_version) values
  ('9a000000-0000-0000-0000-0000000000c1', 'Boxing', 'live', public.current_coach_agreement());
insert into public.engagements (id, athlete_id, coach_id, package_title, package_kind, price_paise, fee_bps, start_date, days_per_week, status, share_data, paid_through) values
  ('9b000000-0000-0000-0000-0000000000e1', '9a000000-0000-0000-0000-0000000000a1', '9a000000-0000-0000-0000-0000000000c1', 'Online coaching', 'monthly', 450000, 1500,
   public.india_today() - 10, 3, 'active', true, public.india_today() + 20);
-- Three paid orders: one past its hold, one still held, one past its hold but with a refund asked.
insert into public.orders (id, engagement_id, amount_paise, fee_bps, kind, period_start, period_end, provider_order_id, status, paid_at) values
  ('9c000000-0000-0000-0000-000000000001', '9b000000-0000-0000-0000-0000000000e1', 450000, 1500, 'first', public.india_today() - 10, public.india_today() + 20, 'order_po1', 'paid', now() - interval '10 days'),
  ('9c000000-0000-0000-0000-000000000002', '9b000000-0000-0000-0000-0000000000e1', 450000, 1500, 'renewal', public.india_today() + 21, public.india_today() + 50, 'order_po2', 'paid', now()),
  ('9c000000-0000-0000-0000-000000000003', '9b000000-0000-0000-0000-0000000000e1', 120000, 1500, 'renewal', public.india_today() + 51, public.india_today() + 80, 'order_po3', 'paid', now() - interval '9 days');
insert into public.payments (id, order_id, provider_payment_id, amount_paise, currency, status, captured_at) values
  ('9d000000-0000-0000-0000-000000000001', '9c000000-0000-0000-0000-000000000001', 'pay_po1', 450000, 'INR', 'captured', now() - interval '10 days'),
  ('9d000000-0000-0000-0000-000000000002', '9c000000-0000-0000-0000-000000000002', 'pay_po2', 450000, 'INR', 'captured', now()),
  ('9d000000-0000-0000-0000-000000000003', '9c000000-0000-0000-0000-000000000003', 'pay_po3', 120000, 'INR', 'captured', now() - interval '9 days');
insert into public.payouts (id, payment_id, coach_id, gross_paise, fee_paise, net_paise, hold_until) values
  ('9e000000-0000-0000-0000-000000000001', '9d000000-0000-0000-0000-000000000001', '9a000000-0000-0000-0000-0000000000c1', 450000, 67500, 382500, now() - interval '3 days'),
  ('9e000000-0000-0000-0000-000000000002', '9d000000-0000-0000-0000-000000000002', '9a000000-0000-0000-0000-0000000000c1', 450000, 67500, 382500, now() + interval '7 days'),
  ('9e000000-0000-0000-0000-000000000003', '9d000000-0000-0000-0000-000000000003', '9a000000-0000-0000-0000-0000000000c1', 120000, 18000, 102000, now() - interval '2 days');
insert into public.refunds (payment_id, amount_paise, reason, status) values ('9d000000-0000-0000-0000-000000000003', 120000, 'first_payment', 'requested');

create function pg_temp.as_user(uid text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;
set local role authenticated;

-- Admins only.
select pg_temp.as_user('9a000000-0000-0000-0000-0000000000c1');
select throws_ok($$ select * from public.admin_payouts_due() $$, '42501', null, 'a coach cannot list payouts to make');
select throws_ok($$ select public.admin_mark_payout_paid('9e000000-0000-0000-0000-000000000001', 'UTR123') $$, '42501', null, 'a coach cannot mark a payout paid');

select pg_temp.as_user('9a000000-0000-0000-0000-0000000000ad');
select is((select array_agg(payout_id order by payout_id) from public.admin_payouts_due()), array['9e000000-0000-0000-0000-000000000001'::uuid],
  'only the payout past its hold with no refund is ready');
select throws_ok($$ select public.admin_mark_payout_paid('9e000000-0000-0000-0000-000000000002', 'UTR1') $$, '22023', 'on_hold', 'a held payout cannot be paid');
select throws_ok($$ select public.admin_mark_payout_paid('9e000000-0000-0000-0000-000000000003', 'UTR2') $$, '22023', 'refund_open', 'a payout with a refund asked cannot be paid');
select throws_ok($$ select public.admin_mark_payout_paid('9e000000-0000-0000-0000-000000000001', '  ') $$, '22023', 'reference_required', 'a bank reference is required');
select lives_ok($$ select public.admin_mark_payout_paid('9e000000-0000-0000-0000-000000000001', 'UTR123456') $$, 'the admin marks the transfer paid');
select is((select status || '|' || paid_ref from public.payouts where id = '9e000000-0000-0000-0000-000000000001'), 'manual_paid|UTR123456', 'paid, with its reference');
select throws_ok($$ select public.admin_mark_payout_paid('9e000000-0000-0000-0000-000000000001', 'UTR9') $$, '22023', 'not_due', 'it cannot be paid twice');
select is((select count(*)::int from public.audit_log where action = 'payout_paid' and target_id = '9e000000-0000-0000-0000-000000000001'), 1, 'the payment is audited');
-- Once the coach is paid, no refund can start for that payment (Codex review).
select throws_ok($$ select public.admin_refund('9d000000-0000-0000-0000-000000000001', 'late') $$, '22023', 'not_refundable', 'an admin cannot refund a payment already paid out');
select pg_temp.as_user('9a000000-0000-0000-0000-0000000000a1');
select throws_ok($$ select public.request_refund('9b000000-0000-0000-0000-0000000000e1') $$, '22023', 'not_refundable', 'nor can the athlete');
select pg_temp.as_user('9a000000-0000-0000-0000-0000000000ad');

-- A failed bank transfer goes back to due, with the reason.
select lives_ok($$ select public.admin_mark_payout_failed('9e000000-0000-0000-0000-000000000001', 'Account closed') $$, 'the admin records a failed transfer');
select is((select status from public.payouts where id = '9e000000-0000-0000-0000-000000000001'), 'manual_due', 'it is due again');

-- The coach's own earnings, as estimates until the CA confirms the fee (Decision 4).
select pg_temp.as_user('9a000000-0000-0000-0000-0000000000c1');
select is((select held_paise || '|' || ready_paise || '|' || paid_paise from public.my_earnings()), '484500|382500|0', 'held, ready and paid totals for the coach');
select pg_temp.as_user('9a000000-0000-0000-0000-0000000000c2');
select is((select held_paise + ready_paise + paid_paise from public.my_earnings()), 0::bigint, 'another coach sees only their own (none)');

select * from finish();
rollback;
