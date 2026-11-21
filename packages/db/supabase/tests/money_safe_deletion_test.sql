-- M4-19: money-safe account deletion, suspension and role loss. Deleting an account never destroys money records
-- and never leaves a subscription charging: an athlete cancels renewing coaching first, a coach with paying clients
-- cannot leave them, and a suspended coach or one who loses the coach role stops every renewal.
begin;
select plan(32);

insert into auth.users (id, email, email_confirmed_at) values
  ('d1000000-0000-0000-0000-0000000000c1', 'del-vikram@t.test', now()),
  ('d1000000-0000-0000-0000-0000000000c2', 'del-ananya@t.test', now()),
  ('d1000000-0000-0000-0000-0000000000c3', 'del-meera@t.test', now()),
  ('d1000000-0000-0000-0000-0000000000c4', 'del-dev@t.test', now()),
  ('d1000000-0000-0000-0000-0000000000ad', 'del-asha@t.test', now()),
  ('d1000000-0000-0000-0000-0000000000a1', 'del-kabir@t.test', now()),
  ('d1000000-0000-0000-0000-0000000000a2', 'del-neha@t.test', now()),
  ('d1000000-0000-0000-0000-0000000000a3', 'del-isha@t.test', now()),
  ('d1000000-0000-0000-0000-0000000000a4', 'del-arjun@t.test', now());
insert into public.user_roles (user_id, role) values
  ('d1000000-0000-0000-0000-0000000000c1', 'coach'), ('d1000000-0000-0000-0000-0000000000c2', 'coach'),
  ('d1000000-0000-0000-0000-0000000000c3', 'coach'), ('d1000000-0000-0000-0000-0000000000c4', 'coach'),
  ('d1000000-0000-0000-0000-0000000000ad', 'admin');
insert into public.coach_profiles (coach_id, headline, status, agreement_version)
select c, 'Coach', 'live', public.current_coach_agreement() from unnest(array[
  'd1000000-0000-0000-0000-0000000000c1', 'd1000000-0000-0000-0000-0000000000c2',
  'd1000000-0000-0000-0000-0000000000c3', 'd1000000-0000-0000-0000-0000000000c4']::uuid[]) c;
-- Kabir renews monthly with Vikram. Neha cancelled with Vikram, but the provider has not stopped her subscription yet.
-- Ananya's one client (Ravi's old engagement, no athlete) ended long ago. Isha renews with Meera, Arjun with Dev.
insert into public.engagements (id, athlete_id, coach_id, package_title, package_kind, price_paise, fee_bps, start_date, days_per_week, status, share_data, paid_through) values
  ('d2000000-0000-0000-0000-0000000000e1', 'd1000000-0000-0000-0000-0000000000a1', 'd1000000-0000-0000-0000-0000000000c1', 'Online coaching', 'monthly', 450000, 1500, public.india_today() - 5, 3, 'active', true, public.india_today() + 25),
  ('d2000000-0000-0000-0000-0000000000e2', 'd1000000-0000-0000-0000-0000000000a2', 'd1000000-0000-0000-0000-0000000000c1', 'Online coaching', 'monthly', 450000, 1500, public.india_today() - 5, 3, 'cancelling', true, public.india_today() + 25),
  ('d2000000-0000-0000-0000-0000000000e3', null, 'd1000000-0000-0000-0000-0000000000c2', 'Form check', 'single', 120000, 1500, public.india_today() - 90, 3, 'ended', true, public.india_today() - 90),
  ('d2000000-0000-0000-0000-0000000000e4', 'd1000000-0000-0000-0000-0000000000a3', 'd1000000-0000-0000-0000-0000000000c3', 'Online coaching', 'monthly', 450000, 1500, public.india_today() - 5, 3, 'active', true, public.india_today() + 25),
  ('d2000000-0000-0000-0000-0000000000e5', 'd1000000-0000-0000-0000-0000000000a4', 'd1000000-0000-0000-0000-0000000000c4', 'Online coaching', 'monthly', 450000, 1500, public.india_today() - 5, 3, 'active', true, public.india_today() + 25);
insert into public.engagements (id, athlete_id, coach_id, package_title, package_kind, price_paise, fee_bps, start_date, days_per_week, status, goals) values
  ('d2000000-0000-0000-0000-0000000000e6', 'd1000000-0000-0000-0000-0000000000a4', 'd1000000-0000-0000-0000-0000000000c3', 'Online coaching', 'monthly', 450000, 1500, public.india_today(), 3, 'accepted', 'Old shoulder injury');
update public.engagements set goals = 'My knee hurts when I run' where id = 'd2000000-0000-0000-0000-0000000000e2';
insert into public.subscriptions (engagement_id, provider_subscription_id, status) values
  ('d2000000-0000-0000-0000-0000000000e1', 'sub_del_kabir', 'active'), ('d2000000-0000-0000-0000-0000000000e2', 'sub_del_neha', 'active'),
  ('d2000000-0000-0000-0000-0000000000e4', 'sub_del_isha', 'active'), ('d2000000-0000-0000-0000-0000000000e5', 'sub_del_arjun', 'active');
insert into public.cancel_reasons (engagement_id, reason) values ('d2000000-0000-0000-0000-0000000000e2', 'injury');
-- Money records for Neha's and Ananya's coaching: a paid order, its captured payment and the coach's payout.
insert into public.orders (id, engagement_id, amount_paise, fee_bps, period_start, period_end, status, paid_at) values
  ('d3000000-0000-0000-0000-0000000000a2', 'd2000000-0000-0000-0000-0000000000e2', 450000, 1500, public.india_today() - 5, public.india_today() + 25, 'paid', now()),
  ('d3000000-0000-0000-0000-0000000000c2', 'd2000000-0000-0000-0000-0000000000e3', 120000, 1500, public.india_today() - 90, public.india_today() - 90, 'paid', now());
insert into public.payments (id, order_id, provider_payment_id, amount_paise, currency, status) values
  ('d4000000-0000-0000-0000-0000000000a2', 'd3000000-0000-0000-0000-0000000000a2', 'pay_del_neha', 450000, 'INR', 'captured'),
  ('d4000000-0000-0000-0000-0000000000c2', 'd3000000-0000-0000-0000-0000000000c2', 'pay_del_ravi', 120000, 'INR', 'captured');
insert into public.payouts (payment_id, coach_id, gross_paise, fee_paise, net_paise, hold_until) values
  ('d4000000-0000-0000-0000-0000000000a2', 'd1000000-0000-0000-0000-0000000000c1', 450000, 67500, 382500, now()),
  ('d4000000-0000-0000-0000-0000000000c2', 'd1000000-0000-0000-0000-0000000000c2', 120000, 18000, 102000, now());

create function pg_temp.emails(template_ text, engagement uuid) returns int language sql as $$
  select count(*)::int from public.email_outbox where template = template_ and data ->> 'engagement' = engagement::text;
$$;
grant execute on all functions in schema pg_temp to authenticated;
set local role authenticated;

-- An athlete whose coaching still renews cancels it first; the app asks before it touches anything.
select set_config('request.jwt.claims', '{"sub":"d1000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
select is(public.why_not_delete_my_account(), 'renewing', 'the app hears that renewing coaching must be cancelled first');
select throws_ok($$ select public.delete_my_account() $$, '22023', 'cancel_coaching_first', 'and deletion is refused');
-- A coach with paying clients cannot leave them.
select set_config('request.jwt.claims', '{"sub":"d1000000-0000-0000-0000-0000000000c1","role":"authenticated"}', true);
select is(public.why_not_delete_my_account(), 'clients', 'a coach with paying clients hears why');
select throws_ok($$ select public.delete_my_account() $$, '22023', 'coach_has_clients', 'and cannot delete their account');
-- An admin hears it before any file is touched.
select set_config('request.jwt.claims', '{"sub":"d1000000-0000-0000-0000-0000000000ad","role":"authenticated"}', true);
select is(public.why_not_delete_my_account(), 'admin', 'an admin hears it first');

-- A coach with payouts still to come cannot delete either.
reset role;
update public.payouts set status = 'manual_due' where payment_id = 'd4000000-0000-0000-0000-0000000000c2';
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"d1000000-0000-0000-0000-0000000000c2","role":"authenticated"}', true);
select is(public.why_not_delete_my_account(), 'payouts', 'a coach with payouts still to come hears why');
select throws_ok($$ select public.delete_my_account() $$, '22023', 'payouts_due', 'and cannot delete yet');
reset role;
update public.payouts set status = 'manual_paid' where payment_id = 'd4000000-0000-0000-0000-0000000000c2';
-- Nobody, an admin through the auth API included, deletes a coach whose clients have paid days to come.
select throws_ok($$ delete from auth.users where id = 'd1000000-0000-0000-0000-0000000000c1' $$, '22023', 'coach_has_clients',
  'a coach with paying clients cannot be deleted by any path');
set local role authenticated;

-- Neha cancelled: she can delete. Her coaching ends, its money records stay, and nothing personal is left on them.
select set_config('request.jwt.claims', '{"sub":"d1000000-0000-0000-0000-0000000000a2","role":"authenticated"}', true);
select is(public.why_not_delete_my_account(), null, 'a client who cancelled can delete');
select lives_ok($$ select public.delete_my_account() $$, 'and does');
reset role;
select is((select row(athlete_id, status)::text from public.engagements where id = 'd2000000-0000-0000-0000-0000000000e2'),
  row(null::uuid, 'ended')::text, 'the coaching ends and keeps no link to her');
select is((select count(*)::int from public.orders where engagement_id = 'd2000000-0000-0000-0000-0000000000e2'), 1, 'the order stays');
select is((select status from public.payments where id = 'd4000000-0000-0000-0000-0000000000a2'), 'captured', 'the payment stays');
select is((select net_paise from public.payouts where payment_id = 'd4000000-0000-0000-0000-0000000000a2'), 382500::bigint, 'the coach''s payout stays');
select is((select count(*)::int from public.cancel_reasons where engagement_id = 'd2000000-0000-0000-0000-0000000000e2'), 0, 'her cancel reason is erased');
select is((select goals from public.engagements where id = 'd2000000-0000-0000-0000-0000000000e2'), '', 'and so are her own words');
select is(pg_temp.emails('coaching_ended', 'd2000000-0000-0000-0000-0000000000e2'), 1, 'the coach is told, and no email waits for her');
select is((select data ->> 'other' from public.email_outbox where template = 'coaching_ended' and data ->> 'engagement' = 'd2000000-0000-0000-0000-0000000000e2'), '',
  'without her name');
select ok(exists (select 1 from public.subscriptions_to_stop() where provider_subscription_id = 'sub_del_neha'),
  'her subscription is handed to the server to stop at the provider');

-- Ananya has no paying clients: she can delete, and her old payout stays with no coach on it.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"d1000000-0000-0000-0000-0000000000c2","role":"authenticated"}', true);
select lives_ok($$ select public.delete_my_account() $$, 'a coach without paying clients can delete');
reset role;
select is((select row(coach_id, net_paise)::text from public.payouts where payment_id = 'd4000000-0000-0000-0000-0000000000c2'),
  row(null::uuid, 102000::bigint)::text, 'her payout record stays, with no coach on it');
select is((select count(*)::int from public.payments where id = 'd4000000-0000-0000-0000-0000000000c2'), 1, 'and so does the payment');

-- Suspending Meera stops Isha's renewals: the paid month runs out, then the coaching ends.
update public.coach_profiles set status = 'suspended' where coach_id = 'd1000000-0000-0000-0000-0000000000c3';
select is((select row(status, cancel_at_period_end, paid_through)::text from public.engagements where id = 'd2000000-0000-0000-0000-0000000000e4'),
  row('cancelling', true, public.india_today() + 25)::text, 'a suspended coach''s clients stop renewing, keeping the paid month');
select is(pg_temp.emails('coaching_stopped', 'd2000000-0000-0000-0000-0000000000e4'), 2, 'both are told');
select ok(exists (select 1 from public.subscriptions_to_stop() where provider_subscription_id = 'sub_del_isha'), 'and the subscription is stopped');
select is((select status from public.engagements where id = 'd2000000-0000-0000-0000-0000000000e6'), 'declined', 'an accepted request waiting for payment closes');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"d1000000-0000-0000-0000-0000000000c3","role":"authenticated"}', true);
reset role;
insert into public.engagements (id, athlete_id, coach_id, package_title, package_kind, price_paise, fee_bps, start_date, days_per_week, status) values
  ('d2000000-0000-0000-0000-0000000000e7', 'd1000000-0000-0000-0000-0000000000a4', 'd1000000-0000-0000-0000-0000000000c3', 'Online coaching', 'monthly', 450000, 1500, public.india_today(), 3, 'requested');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"d1000000-0000-0000-0000-0000000000c3","role":"authenticated"}', true);
select throws_ok($$ select public.decide_request('d2000000-0000-0000-0000-0000000000e7', true) $$, '22023', 'not_live', 'a suspended coach cannot accept anyone');
select lives_ok($$ select public.decide_request('d2000000-0000-0000-0000-0000000000e7', false) $$, 'but can still decline');
reset role;
update public.coach_profiles set status = 'live' where coach_id = 'd1000000-0000-0000-0000-0000000000c3';
select is((select status from public.engagements where id = 'd2000000-0000-0000-0000-0000000000e4'), 'cancelling', 'lifting the suspension does not restart charging');

-- Dev loses the coach role: Arjun's renewals stop the same way.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"d1000000-0000-0000-0000-0000000000ad","role":"authenticated"}', true);
select lives_ok($$ select public.admin_set_roles('d1000000-0000-0000-0000-0000000000c4', '{athlete}', '{athlete,coach}') $$, 'an admin removes the coach role');
reset role;
select is((select status from public.engagements where id = 'd2000000-0000-0000-0000-0000000000e5'), 'cancelling', 'and that coach''s clients stop renewing');
select is(pg_temp.emails('coaching_stopped', 'd2000000-0000-0000-0000-0000000000e5'), 2, 'both are told');

select * from finish();
rollback;
