-- Renewal by a new Order each month (docs/plans/remaining-tasks-plan.md, Decision 1, approved 2026-11-23). An active
-- monthly engagement without a subscription renews when the athlete pays a renewal order: from 5 days before
-- paid_through to the end of a 3-day grace. The coach keeps access in the grace; after it, the coaching lapses as
-- unpaid. Subscriptions (M4-11a, fake only) keep working as before.

-- Service role only, from the pay action: opens (or reuses) the renewal order for the next month.
create function public.start_renewal_checkout(engagement uuid, athlete uuid)
returns table (order_id uuid, amount_paise bigint, provider_order_id text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  g public.engagements;
  ps date;
  o public.orders;
begin
  select * into g from public.engagements where id = engagement for update;
  if g.id is null or g.athlete_id is distinct from athlete or g.status <> 'active' or g.package_kind <> 'monthly'
     or g.paid_through < public.india_today() - 3
     or exists (select 1 from public.subscriptions s where s.engagement_id = g.id and s.status in ('active', 'pending')) then
    raise exception 'not_payable' using errcode = '22023';
  end if;
  if g.paid_through > public.india_today() + 5 then
    raise exception 'not_due' using errcode = '22023';
  end if;
  ps := g.paid_through + 1;
  select * into o from public.orders where orders.engagement_id = g.id and kind = 'renewal' and status = 'created' and period_start = ps;
  if o.id is null then
    insert into public.orders (engagement_id, amount_paise, fee_bps, kind, period_start, period_end)
    values (g.id, g.price_paise, g.fee_bps, 'renewal', ps, public.month_period_end(ps)) returning * into o;
  end if;
  return query select o.id, o.amount_paise, o.provider_order_id;
end;
$$;
revoke all on function public.start_renewal_checkout(uuid, uuid) from public, anon, authenticated;
grant execute on function public.start_renewal_checkout(uuid, uuid) to service_role;

-- apply_payment_event as in 20261216000000_refunds.sql, plus paid renewal orders.
create or replace function public.apply_payment_event(event_id text, event_type text, body jsonb)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  ev bigint;
  p jsonb := body -> 'payload' -> 'payment' -> 'entity';
  pid text := p ->> 'id';
  amount bigint;
  o public.orders;
  g public.engagements;
  pay uuid;
  fee bigint;
  note_ text;
begin
  insert into public.payment_events (provider_event_id, type, payload) values (event_id, event_type, body)
  on conflict (provider_event_id) do nothing returning id into ev;
  if ev is null then
    return 'duplicate';
  end if;

  -- Renewals, failed renewals and cancels arrive as subscription events (M4-11).
  if event_type like 'subscription.%' then
    return public.apply_subscription_event(ev, event_type, body);
  end if;
  -- Refunds arrive as refund events (M4-12).
  if event_type like 'refund.%' then
    return public.apply_refund_event(ev, event_type, body);
  end if;
  if event_type <> 'payment.captured' then
    update public.payment_events set result = 'ignored', note = 'event type not handled yet' where id = ev;
    return 'ignored';
  end if;
  begin
    amount := (p ->> 'amount')::bigint;
  exception when others then
    amount := null;
  end;
  select * into o from public.orders where provider_order_id = p ->> 'order_id' for update;
  if o.id is null or pid is null or char_length(pid) > 64 then
    update public.payment_events set result = 'ignored', note = 'unknown order or bad payment id' where id = ev;
    return 'ignored';
  end if;
  if o.provider_order_id like 'fake\_%' and not coalesce((select fake_allowed from public.payment_settings), false) then
    update public.payment_events set result = 'ignored', note = 'fake payments are off' where id = ev;
    return 'ignored';
  end if;
  if amount is distinct from o.amount_paise or (p ->> 'currency') is distinct from o.currency then
    update public.payment_events set result = 'ignored', note = 'amount or currency does not match the order' where id = ev;
    return 'ignored';
  end if;
  if exists (select 1 from public.payments where provider_payment_id = pid) then
    update public.payment_events set result = 'ignored', note = 'payment already recorded' where id = ev;
    return 'ignored';
  end if;
  select * into g from public.engagements where id = o.engagement_id for update;
  -- A renewal order (Decision 1): paid only while it is open, the coaching is still active and renews by orders, and
  -- the order starts the day after the paid date. Then the month is added once, with one payment and one payout.
  if o.kind = 'renewal' then
    if o.status <> 'created' or g.status <> 'active' or g.paid_through is distinct from o.period_start - 1
       or exists (select 1 from public.subscriptions s where s.engagement_id = g.id and s.status in ('active', 'pending')) then
      insert into public.payments (order_id, provider_payment_id, amount_paise, currency, status) values (o.id, pid, amount, o.currency, 'duplicate');
      update public.payment_events set result = 'applied',
        note = 'owed back: renewal order ' || o.status || ', engagement ' || coalesce(g.status, 'gone') where id = ev;
      return 'applied';
    end if;
    update public.orders set status = 'paid', paid_at = now() where id = o.id;
    insert into public.payments (order_id, provider_payment_id, amount_paise, currency, status) values (o.id, pid, amount, o.currency, 'captured')
    returning id into pay;
    update public.engagements set paid_through = o.period_end where id = g.id returning * into g;
    fee := public.fee_paise(amount, o.fee_bps);
    insert into public.payouts (payment_id, coach_id, gross_paise, fee_paise, net_paise, hold_until)
    values (pay, g.coach_id, amount, fee, amount - fee, now() + make_interval(days => public.payout_hold_days()));
    perform public.queue_coaching_emails(g, 'coaching_renewed');
    update public.payment_events set result = 'applied' where id = ev;
    return 'applied';
  end if;

  -- Only an open first order on an engagement still waiting to start becomes paid. Anything else (a second capture,
  -- a late payment on an expired order, or a payment after the engagement closed) is money owed back: recorded,
  -- flagged by money_invariants, refunded in M4-12, and never a second activation or payout.
  if o.status <> 'created' or o.kind <> 'first' or g.status <> 'accepted' then
    insert into public.payments (order_id, provider_payment_id, amount_paise, currency, status) values (o.id, pid, amount, o.currency, 'duplicate');
    update public.payment_events set result = 'applied',
      note = 'owed back: order ' || o.status || ', engagement ' || coalesce(g.status, 'gone') where id = ev;
    return 'applied';
  end if;

  -- The paid month starts on the start date, or today if that has passed: the athlete never pays for days gone by.
  o.period_start := greatest(g.start_date, public.india_today());
  o.period_end := case when g.package_kind = 'monthly' then public.month_period_end(o.period_start) else o.period_start end;
  update public.orders set status = 'paid', paid_at = now(), period_start = o.period_start, period_end = o.period_end where id = o.id;
  insert into public.payments (order_id, provider_payment_id, amount_paise, currency, status) values (o.id, pid, amount, o.currency, 'captured')
  returning id into pay;
  update public.engagements set status = 'active', paid_through = o.period_end where id = g.id;
  fee := public.fee_paise(amount, o.fee_bps);
  -- A session stays refundable until 2 days before it, so its payout waits at least until the day before (M4-12).
  insert into public.payouts (payment_id, coach_id, gross_paise, fee_paise, net_paise, hold_until)
  values (pay, g.coach_id, amount, fee, amount - fee, greatest(now() + make_interval(days => public.payout_hold_days()),
    case when g.package_kind = 'single' then (o.period_start - 1)::timestamp at time zone 'Asia/Kolkata' end));
  if g.athlete_id is not null then
    insert into public.notifications (user_id, kind, title, body, link, ref)
    values (g.athlete_id, 'payment_received', 'Payment received', 'We received your payment for ' || g.package_title || '. Coaching runs ' || o.period_start || ' to ' || o.period_end || '.',
      '/coaching', o.id::text)
    on conflict do nothing;
  end if;
  if g.coach_id is not null then
    insert into public.notifications (user_id, kind, title, body, link, ref)
    values (g.coach_id, 'new_client', 'New paying client',
      coalesce(nullif((select display_name from public.profiles where id = g.athlete_id), ''), 'An athlete') || ' paid for ' || g.package_title || '.',
      '/coach/clients', o.id::text)
    on conflict do nothing;
  end if;
  update public.payment_events set result = 'applied' where id = ev;
  return 'applied';
end;
$$;

-- sweep_engagements as in 20261214000000_renewals.sql, plus Decision 1: monthly coaching that renews by orders gets
-- a 3-day grace, then lapses as unpaid; and its athlete gets a reminder 5 days and 1 day before the paid date.
create or replace function public.sweep_engagements()
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  g public.engagements;
  by_sub boolean;
  unpaid boolean;
  n int := 0;
begin
  -- One sweep at a time, so two overlapping runs cannot both send the same reminder (Codex review).
  perform pg_advisory_xact_lock(hashtext('sweep_engagements'));
  for g in
    select * from public.engagements e
    where e.status in ('active', 'cancelling') and e.paid_through < public.india_today()
    for update skip locked
  loop
    by_sub := g.status = 'active' and g.package_kind = 'monthly'
      and exists (select 1 from public.subscriptions s where s.engagement_id = g.id and s.status in ('active', 'pending'));
    unpaid := g.status = 'active' and g.package_kind = 'monthly' and not by_sub;
    if by_sub and g.paid_through >= public.india_today() - 7 then
      continue; -- the provider is still retrying
    end if;
    if unpaid and g.paid_through >= public.india_today() - 3 then
      continue; -- the grace: the athlete can still pay the renewal order
    end if;
    update public.engagements set status = case when by_sub or unpaid then 'lapsed' else 'ended' end, ended_at = now() where id = g.id returning * into g;
    perform public.queue_coaching_emails(g, case when by_sub then 'coaching_lapsed' when unpaid then 'coaching_unpaid' else 'coaching_ended' end);
    n := n + 1;
  end loop;

  -- Renewal reminders, to the athlete only, once per paid date and day.
  insert into public.email_outbox (user_id, to_email, template, data)
  select u.id, u.email, 'renewal_due', jsonb_build_object('engagement', e.id, 'role', 'athlete',
    'other', coalesce(nullif(c.display_name, ''), ''), 'package', e.package_title, 'paid_through', e.paid_through,
    'amount', e.price_paise, 'days', e.paid_through - public.india_today())
  from public.engagements e
  join auth.users u on u.id = e.athlete_id
  left join public.profiles c on c.id = e.coach_id
  where e.status = 'active' and e.package_kind = 'monthly' and e.paid_through - public.india_today() in (5, 1)
    and not exists (select 1 from public.subscriptions s where s.engagement_id = e.id and s.status in ('active', 'pending'))
    and not exists (select 1 from public.email_outbox x where x.template = 'renewal_due' and x.data ->> 'engagement' = e.id::text
      and x.data ->> 'paid_through' = e.paid_through::text and (x.data ->> 'days')::int = e.paid_through - public.india_today());
  return n;
end;
$$;

-- engagement_opens as in 20261214000000_renewals.sql, plus the 3-day grace of coaching that renews by orders.
create or replace function public.engagement_opens(g public.engagements)
returns boolean
language sql
stable
set search_path = ''
as $$
  select g.status in ('active', 'cancelling') and g.share_data and (g.paid_through >= public.india_today()
    or (g.status = 'active' and g.paid_through = public.india_today() - 1
      and exists (select 1 from public.subscriptions s where s.engagement_id = g.id and s.status = 'active'))
    or (g.status = 'active' and g.package_kind = 'monthly' and g.paid_through >= public.india_today() - 3
      and not exists (select 1 from public.subscriptions s where s.engagement_id = g.id and s.status in ('active', 'pending'))));
$$;
