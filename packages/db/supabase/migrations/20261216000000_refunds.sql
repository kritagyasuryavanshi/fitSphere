-- M4-12: refunds and payout reversal (docs/plans/m4-12-refunds.md). Owner terms (O-05, MEMORY.md): full refunds only;
-- coaching within 7 days of the first payment; no refund on a renewal; a 1:1 session up to 24 hours before; an admin
-- can refund by hand. Money owed back (payments marked duplicate) is refunded by the daily cron, whatever the renewal
-- rule says. The provider's refund events go through apply_payment_event, still the one writer of money state.

alter table public.orders drop constraint orders_status_check;
alter table public.orders add constraint orders_status_check check (status in ('created', 'paid', 'expired', 'failed', 'refunded'));

alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check
  check (kind in ('coach_feedback', 'new_lesson', 'session_reminder', 'request_accepted', 'payment_due', 'new_request', 'request_declined',
    'request_withdrawn', 'new_message', 'payment_received', 'new_client', 'refund_processed'));

create table public.refunds (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.payments (id),
  provider_refund_id text unique check (char_length(provider_refund_id) <= 64),
  -- Full refunds only: always the payment's amount.
  amount_paise bigint not null check (amount_paise > 0),
  -- first_payment: the athlete, within the terms. owed_back: the cron, for a duplicate payment. admin: by hand, or
  -- made at the provider's dashboard.
  reason text not null check (reason in ('first_payment', 'owed_back', 'admin')),
  status text not null default 'requested' check (status in ('requested', 'processed', 'failed')),
  requested_by uuid references public.profiles (id) on delete set null,
  note text check (char_length(note) <= 500),
  created_at timestamptz not null default now(),
  processed_at timestamptz
);
-- At most one live refund per payment: never refunded twice. A failed refund can be tried again.
create unique index refunds_one_live on public.refunds (payment_id) where status in ('requested', 'processed');
alter table public.refunds enable row level security;
revoke all on public.refunds from anon, authenticated;
grant all on public.refunds to service_role;
-- The athlete and the coach read a refund's state, never who asked for it or an admin's note.
grant select (id, payment_id, amount_paise, reason, status, created_at, processed_at) on public.refunds to authenticated;
create policy refunds_select_party on public.refunds for select to authenticated
  using (public.is_admin() or exists (select 1 from public.payments p join public.orders o on o.id = p.order_id join public.engagements g on g.id = o.engagement_id
    where p.id = payment_id and (g.athlete_id = (select auth.uid()) or g.coach_id = (select auth.uid()))));

-- How long after the first payment an athlete can refund coaching themselves.
create function public.refund_window_days()
returns int
language sql
immutable
set search_path = ''
as $$
  select 7;
$$;

-- The payment the athlete can refund themselves now, or null: the first payment of running coaching, with no live
-- refund, within 7 days for monthly coaching never renewed, or 2 or more days before a session.
-- shortcut: sessions have a date but no time until M4-17, so "24 hours before" is 2 days before the date.
create function public.refundable_payment(g public.engagements)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select p.id from public.orders o join public.payments p on p.order_id = o.id
  where o.engagement_id = g.id and o.kind = 'first' and o.status = 'paid' and p.status = 'captured'
    and g.status in ('active', 'cancelling') and g.athlete_id is not null
    and not exists (select 1 from public.refunds r where r.payment_id = p.id and r.status in ('requested', 'processed'))
    and case when g.package_kind = 'monthly'
      then p.captured_at > now() - make_interval(days => public.refund_window_days())
        and not exists (select 1 from public.orders x where x.engagement_id = g.id and x.kind = 'renewal' and x.status = 'paid')
      else o.period_start - 2 >= public.india_today() end
  limit 1;
$$;

-- The amount the caller can get back for their own coaching now, or null.
create function public.refund_quote(engagement uuid)
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  select p.amount_paise from public.engagements g join public.payments p on p.id = public.refundable_payment(g)
  where g.id = engagement and g.athlete_id = (select auth.uid());
$$;

-- The athlete asks for their refund. Returns what the server sends to the provider; the coaching runs until the
-- provider confirms the refund.
create function public.request_refund(engagement uuid)
returns table (refund_id uuid, provider_payment_id text, amount_paise bigint)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_variable
declare
  g public.engagements;
  pay public.payments;
  r uuid;
begin
  select * into g from public.engagements where id = engagement for update;
  if not found or auth.uid() is null or g.athlete_id is distinct from auth.uid() then
    raise exception 'not_yours' using errcode = '42501';
  end if;
  select * into pay from public.payments where id = public.refundable_payment(g) for update;
  if pay.id is null then
    raise exception 'not_refundable' using errcode = '22023';
  end if;
  insert into public.refunds (payment_id, amount_paise, reason, requested_by) values (pay.id, pay.amount_paise, 'first_payment', auth.uid())
  returning id into r;
  insert into public.audit_log (actor_id, action, target_id, details) values (auth.uid(), 'refund_requested', g.athlete_id,
    jsonb_build_object('refund', r, 'payment', pay.id, 'engagement', g.id, 'amount_paise', pay.amount_paise, 'reason', 'first_payment'));
  return query select r, pay.provider_payment_id, pay.amount_paise;
end;
$$;

-- An admin refunds any payment not yet refunded, outside the terms. A payment owed back keeps that reason.
create function public.admin_refund(payment uuid, why text)
returns table (refund_id uuid, provider_payment_id text, amount_paise bigint)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_variable
declare
  pay public.payments;
  athlete uuid;
  r uuid;
begin
  if not public.is_admin() then
    raise exception 'not_admin' using errcode = '42501';
  end if;
  select * into pay from public.payments where id = payment for update;
  if pay.id is null or pay.status not in ('captured', 'duplicate')
    or exists (select 1 from public.refunds x where x.payment_id = pay.id and x.status in ('requested', 'processed')) then
    raise exception 'not_refundable' using errcode = '22023';
  end if;
  insert into public.refunds (payment_id, amount_paise, reason, requested_by, note)
  values (pay.id, pay.amount_paise, case when pay.status = 'duplicate' then 'owed_back' else 'admin' end, auth.uid(), left(nullif(btrim(why), ''), 500))
  returning id into r;
  select g.athlete_id into athlete from public.orders o join public.engagements g on g.id = o.engagement_id where o.id = pay.order_id;
  insert into public.audit_log (actor_id, action, target_id, details) values (auth.uid(), 'refund_requested', athlete,
    jsonb_build_object('refund', r, 'payment', pay.id, 'amount_paise', pay.amount_paise, 'reason', 'admin', 'note', left(nullif(btrim(why), ''), 500)));
  return query select r, pay.provider_payment_id, pay.amount_paise;
end;
$$;

-- Service role only, from the daily cron: a refund for every payment owed back that has none. Returns them, so the
-- cron sends them in the same run.
create function public.queue_owed_back_refunds()
returns table (refund_id uuid, provider_payment_id text, amount_paise bigint)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  return query
  with q as (
    insert into public.refunds (payment_id, amount_paise, reason)
    select p.id, p.amount_paise, 'owed_back' from public.payments p
    where p.status = 'duplicate'
      and not exists (select 1 from public.refunds r where r.payment_id = p.id and r.status in ('requested', 'processed'))
    on conflict do nothing
    returning id, payment_id, amount_paise
  ), logged as (
    insert into public.audit_log (actor_id, action, target_id, details)
    select null, 'refund_requested', g.athlete_id, jsonb_build_object('refund', q.id, 'payment', q.payment_id, 'amount_paise', q.amount_paise, 'reason', 'owed_back')
    from q join public.payments p on p.id = q.payment_id join public.orders o on o.id = p.order_id join public.engagements g on g.id = o.engagement_id
    returning 1
  )
  select q.id, p.provider_payment_id, q.amount_paise from q join public.payments p on p.id = q.payment_id;
end;
$$;

-- Service role only: requested refunds not yet at the provider, older than the given minutes, so the cron leaves
-- alone one the server is still sending.
create function public.refunds_to_send(min_age_minutes int)
returns table (refund_id uuid, provider_payment_id text, amount_paise bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select r.id, p.provider_payment_id, r.amount_paise from public.refunds r join public.payments p on p.id = r.payment_id
  where r.status = 'requested' and r.provider_refund_id is null and r.created_at <= now() - make_interval(mins => min_age_minutes)
  order by r.created_at;
$$;

-- Service role only: records the provider's refund id, once, and returns the one attached.
create function public.attach_provider_refund(refund uuid, provider_refund text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  attached text;
begin
  update public.refunds set provider_refund_id = provider_refund where id = refund and provider_refund_id is null and status = 'requested'
  returning provider_refund_id into attached;
  if attached is null then
    select provider_refund_id into attached from public.refunds where id = refund;
  end if;
  if attached is null then
    raise exception 'not_open' using errcode = '22023';
  end if;
  return attached;
end;
$$;

-- Refund events, called only from apply_payment_event once the event is recorded. Returns applied or ignored.
create function public.apply_refund_event(ev bigint, event_type text, body jsonb)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  e jsonb := body -> 'payload' -> 'refund' -> 'entity';
  rid text := e ->> 'id';
  pid text := e ->> 'payment_id';
  amount bigint;
  r public.refunds;
  pay public.payments;
  o public.orders;
  g public.engagements;
  was text;
  athlete uuid;
begin
  begin
    amount := (e ->> 'amount')::bigint;
  exception when others then
    amount := null;
  end;
  if rid is null or pid is null or char_length(rid) > 64 then
    update public.payment_events set result = 'ignored', note = 'no refund or payment id' where id = ev;
    return 'ignored';
  end if;
  if (rid like 'fake\_%' or pid like 'fake\_%') and not coalesce((select fake_allowed from public.payment_settings), false) then
    update public.payment_events set result = 'ignored', note = 'fake payments are off' where id = ev;
    return 'ignored';
  end if;
  -- Locks in the order request_refund takes them: the engagement, then the payment.
  select g2.* into g from public.payments p2 join public.orders o2 on o2.id = p2.order_id join public.engagements g2 on g2.id = o2.engagement_id
  where p2.provider_payment_id = pid;
  if g.id is not null then
    perform 1 from public.engagements where id = g.id for update;
  end if;
  select * into pay from public.payments where provider_payment_id = pid for update;
  if pay.id is null then
    update public.payment_events set result = 'ignored', note = 'unknown payment' where id = ev;
    return 'ignored';
  end if;
  if amount is distinct from pay.amount_paise or (e ->> 'currency') is distinct from pay.currency then
    update public.payment_events set result = 'ignored', note = 'not a full refund of the payment' where id = ev;
    return 'ignored';
  end if;
  -- The refund by its provider id, or the requested refund of this payment the server has not attached yet.
  select * into r from public.refunds where provider_refund_id = rid for update;
  if r.id is null then
    select * into r from public.refunds where payment_id = pay.id and status = 'requested' and provider_refund_id is null for update;
    if r.id is not null then
      update public.refunds set provider_refund_id = rid where id = r.id returning * into r;
    end if;
  end if;
  if r.id is not null and r.payment_id <> pay.id then
    update public.payment_events set result = 'ignored', note = 'refund belongs to another payment' where id = ev;
    return 'ignored';
  end if;
  select g2.athlete_id into athlete from public.orders o2 join public.engagements g2 on g2.id = o2.engagement_id where o2.id = pay.order_id;

  if event_type = 'refund.failed' then
    if r.id is null or r.status <> 'requested' then
      update public.payment_events set result = 'ignored', note = 'no requested refund' where id = ev;
      return 'ignored';
    end if;
    update public.refunds set status = 'failed' where id = r.id;
    insert into public.audit_log (actor_id, action, target_id, details) values (null, 'refund_failed', athlete,
      jsonb_build_object('refund', r.id, 'payment', pay.id, 'amount_paise', r.amount_paise));
    update public.payment_events set result = 'applied' where id = ev;
    return 'applied';
  elsif event_type <> 'refund.processed' then
    update public.payment_events set result = 'ignored', note = 'event type not handled yet' where id = ev;
    return 'ignored';
  end if;

  if r.status = 'processed' or pay.status not in ('captured', 'duplicate') then
    update public.payment_events set result = 'ignored', note = 'payment already refunded' where id = ev;
    return 'ignored';
  end if;
  if exists (select 1 from public.refunds x where x.payment_id = pay.id and x.status in ('requested', 'processed') and x.id is distinct from r.id) then
    update public.payment_events set result = 'ignored', note = 'a second refund for one payment' where id = ev;
    return 'ignored';
  end if;
  if r.id is null then
    -- Made at the provider's dashboard: recorded as an admin refund.
    insert into public.refunds (payment_id, provider_refund_id, amount_paise, reason, note)
    values (pay.id, rid, pay.amount_paise, 'admin', 'made at the provider') returning * into r;
  end if;
  update public.refunds set status = 'processed', processed_at = now() where id = r.id returning * into r;
  update public.payments set status = 'refunded' where id = pay.id;

  if pay.status = 'captured' then
    select * into o from public.orders where id = pay.order_id for update;
    update public.orders set status = 'refunded' where id = o.id and status = 'paid';
    -- A payout not yet paid is reversed; one already paid stays, and money_invariants flags it for an admin.
    update public.payouts set status = 'reversed' where payment_id = pay.id and status in ('pending', 'on_hold', 'manual_due');
    select * into g from public.engagements where id = o.engagement_id for update;
    was := g.status;
    if o.kind = 'first' and exists (select 1 from public.orders x where x.engagement_id = g.id and x.kind = 'renewal' and x.status = 'paid') then
      -- An admin refunds the first month of coaching already renewed: the months paid since run on.
      null;
    elsif o.kind = 'first' then
      -- The first payment back: the coaching is refunded and access ends at once.
      if was <> 'refunded' then
        update public.engagements set status = 'refunded', ended_at = coalesce(ended_at, now()) where id = g.id returning * into g;
        perform public.queue_coaching_emails(g, 'coaching_refunded');
      end if;
    else
      -- A renewed month back (an admin's refund): the coaching ends, paid to the end of the month before. The
      -- earlier months were real coaching, so it is ended, not refunded.
      update public.engagements set paid_through = least(paid_through, o.period_start - 1),
        status = case when status in ('active', 'cancelling') then 'ended' else status end,
        ended_at = case when status in ('active', 'cancelling') then coalesce(ended_at, now()) else ended_at end
      where id = g.id returning * into g;
      if was in ('active', 'cancelling') then
        perform public.queue_coaching_emails(g, 'coaching_ended');
      end if;
    end if;
  end if;

  if athlete is not null then
    insert into public.notifications (user_id, kind, title, body, link, ref)
    select athlete, 'refund_processed', 'Refund sent',
      'We refunded your payment for ' || g2.package_title || '. Your bank can take 5 to 7 working days to show it.', '/coaching', r.id::text
    from public.orders o2 join public.engagements g2 on g2.id = o2.engagement_id where o2.id = pay.order_id
    on conflict do nothing;
  end if;
  insert into public.audit_log (actor_id, action, target_id, details) values (null, 'refund_processed', athlete,
    jsonb_build_object('refund', r.id, 'payment', pay.id, 'amount_paise', r.amount_paise, 'reason', r.reason));
  update public.payment_events set result = 'applied' where id = ev;
  return 'applied';
end;
$$;

-- apply_payment_event as in 20261214000000_renewals.sql, handing refund events to apply_refund_event, and holding a
-- session's payout until the session can no longer be refunded.
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
  -- Only an open order on an engagement still waiting to start becomes paid. Anything else (a second capture, a late
  -- payment on an expired order, or a payment after the engagement closed) is money owed back: recorded, flagged by
  -- money_invariants, refunded in M4-12, and never a second activation or payout.
  -- Renewals never come through here: they arrive as subscription.charged (apply_subscription_event).
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

-- money_invariants as in 20261214000000_renewals.sql, plus the refund rules.
create or replace function public.money_invariants()
returns table (rule text, ref uuid)
language sql
stable
security definer
set search_path = ''
as $$
  select 'active engagement without a captured payment', g.id from public.engagements g
  where g.status in ('active', 'cancelling')
    and not exists (select 1 from public.orders o join public.payments p on p.order_id = o.id where o.engagement_id = g.id and p.status = 'captured')
  union all
  select 'paid order without exactly one captured payment', o.id from public.orders o
  where o.status = 'paid' and (select count(*) from public.payments p where p.order_id = o.id and p.status = 'captured') <> 1
  union all
  select 'captured payment amount differs from its order', p.id from public.payments p join public.orders o on o.id = p.order_id
  where p.status = 'captured' and p.amount_paise <> o.amount_paise
  union all
  select 'captured payment without a payout', p.id from public.payments p
  where p.status = 'captured' and not exists (select 1 from public.payouts u where u.payment_id = p.id)
  union all
  select 'payment owed back to the athlete', p.id from public.payments p where p.status = 'duplicate'
  union all
  select 'capture event ignored', null::uuid from public.payment_events e where e.type in ('payment.captured', 'subscription.charged') and e.result = 'ignored'
  union all
  select 'payout is not the payment less the fee', u.id from public.payouts u join public.payments p on p.id = u.payment_id join public.orders o on o.id = p.order_id
  where u.gross_paise <> p.amount_paise or u.fee_paise <> public.fee_paise(p.amount_paise, o.fee_bps)
  union all
  select 'refund failed', r.id from public.refunds r
  where r.status = 'failed' and not exists (select 1 from public.refunds x where x.payment_id = r.payment_id and x.status in ('requested', 'processed'))
  union all
  select 'refund waiting over a day', r.id from public.refunds r where r.status = 'requested' and r.created_at < now() - interval '1 day'
  union all
  select 'refund is not the full payment', r.id from public.refunds r join public.payments p on p.id = r.payment_id where r.amount_paise <> p.amount_paise
  union all
  select 'refund after the coach was paid', u.id from public.payouts u join public.payments p on p.id = u.payment_id
  where p.status = 'refunded' and u.status in ('processed', 'manual_paid')
  union all
  select 'running coaching with its first payment refunded', g.id from public.engagements g
  where g.status in ('active', 'cancelling')
    and exists (select 1 from public.orders o join public.payments p on p.order_id = o.id where o.engagement_id = g.id and o.kind = 'first' and p.status = 'refunded')
    and not exists (select 1 from public.orders x where x.engagement_id = g.id and x.kind = 'renewal' and x.status = 'paid')
  union all
  -- Only an ignored refund event that points to a problem; a type with nothing to do, or a repeat, is not one.
  select 'refund event ignored', null::uuid from public.payment_events e where e.type like 'refund.%' and e.result = 'ignored'
    and e.note not in ('event type not handled yet', 'payment already refunded', 'no requested refund', 'fake payments are off');
$$;

revoke all on function public.refund_window_days() from public;
grant execute on function public.refund_window_days() to anon, authenticated, service_role;
revoke all on function public.refundable_payment(public.engagements), public.apply_refund_event(bigint, text, jsonb) from public, anon, authenticated;
revoke all on function public.refund_quote(uuid), public.request_refund(uuid), public.admin_refund(uuid, text) from public, anon;
grant execute on function public.refund_quote(uuid), public.request_refund(uuid), public.admin_refund(uuid, text) to authenticated;
revoke all on function public.queue_owed_back_refunds(), public.refunds_to_send(int), public.attach_provider_refund(uuid, text) from public, anon, authenticated;
grant execute on function public.queue_owed_back_refunds(), public.refunds_to_send(int), public.attach_provider_refund(uuid, text) to service_role;
