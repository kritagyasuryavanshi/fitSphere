-- Audit fix: "Download my data" lists the person's money records. The athlete sees their payments, refunds and
-- subscriptions; the coach sees their payouts. Nobody sees another person's records or the refund note.
begin;
select plan(9);

insert into auth.users (id, email, email_confirmed_at) values
  ('fa000000-0000-0000-0000-0000000000c1', 'xm-vikram@t.test', now()),
  ('fa000000-0000-0000-0000-0000000000a1', 'xm-kabir@t.test', now()),
  ('fa000000-0000-0000-0000-0000000000a2', 'xm-neha@t.test', now());
insert into public.user_roles (user_id, role) values ('fa000000-0000-0000-0000-0000000000c1', 'coach');
insert into public.coach_profiles (coach_id, headline, status, agreement_version) values
  ('fa000000-0000-0000-0000-0000000000c1', 'Boxing', 'live', public.current_coach_agreement());
insert into public.engagements (id, athlete_id, coach_id, package_title, package_kind, price_paise, fee_bps, start_date, days_per_week, status, share_data, paid_through) values
  ('fb000000-0000-0000-0000-0000000000e1', 'fa000000-0000-0000-0000-0000000000a1', 'fa000000-0000-0000-0000-0000000000c1', 'Online coaching', 'monthly', 450000, 1500,
   public.india_today() - 2, 3, 'refunded', true, public.month_period_end(public.india_today() - 2));
insert into public.orders (id, engagement_id, amount_paise, fee_bps, kind, period_start, period_end, provider_order_id, status, paid_at) values
  ('fc000000-0000-0000-0000-0000000000e1', 'fb000000-0000-0000-0000-0000000000e1', 450000, 1500, 'first', public.india_today() - 2,
   public.month_period_end(public.india_today() - 2), 'order_xm1', 'refunded', now() - interval '2 days');
insert into public.payments (id, order_id, provider_payment_id, amount_paise, currency, status, captured_at) values
  ('fd000000-0000-0000-0000-0000000000e1', 'fc000000-0000-0000-0000-0000000000e1', 'pay_xm1', 450000, 'INR', 'captured', now() - interval '2 days');
insert into public.refunds (payment_id, provider_refund_id, amount_paise, reason, status, requested_by, note, processed_at) values
  ('fd000000-0000-0000-0000-0000000000e1', 'rfnd_xm1', 450000, 'first_payment', 'processed', 'fa000000-0000-0000-0000-0000000000a1', 'admin only note', now());
insert into public.subscriptions (engagement_id, provider_subscription_id, status) values
  ('fb000000-0000-0000-0000-0000000000e1', 'sub_xm1', 'cancelled');
insert into public.payouts (payment_id, coach_id, gross_paise, fee_paise, net_paise, hold_until, status) values
  ('fd000000-0000-0000-0000-0000000000e1', 'fa000000-0000-0000-0000-0000000000c1', 450000, 67500, 382500, now() + interval '5 days', 'reversed');

create function pg_temp.as_user(uid text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;
grant execute on all functions in schema pg_temp to authenticated, anon;
set local role authenticated;

select pg_temp.as_user('fa000000-0000-0000-0000-0000000000a1');
select is(jsonb_array_length(public.export_my_data() -> 'payments'), 1, 'the athlete file lists their payment');
select is(public.export_my_data() #>> '{payments,0,amount_paise}', '450000', 'with its amount');
select is(public.export_my_data() #>> '{payments,0,status}', 'refunded', 'and its status');
select is(public.export_my_data() #>> '{payments,0,refunds,0,status}', 'processed', 'the payment lists its refund');
select ok(not (public.export_my_data() #> '{payments,0,refunds,0}') ? 'note', 'the refund note stays out');
select is(public.export_my_data() #>> '{payments,0,subscription_status}', 'cancelled', 'the subscription status shows');
select is(jsonb_array_length(public.export_my_data() -> 'payouts'), 0, 'an athlete has no payouts');

select pg_temp.as_user('fa000000-0000-0000-0000-0000000000c1');
select is(public.export_my_data() #>> '{payouts,0,net_paise}', '382500', 'the coach file lists the payout');

select pg_temp.as_user('fa000000-0000-0000-0000-0000000000a2');
select is(jsonb_array_length(public.export_my_data() -> 'payments'), 0, 'another athlete sees no payments');

select * from finish();
rollback;
