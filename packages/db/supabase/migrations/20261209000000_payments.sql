-- M4-09a: the payment core (docs/plans/m4-plan.md, section 2). Money state changes in one place, apply_payment_event,
-- driven by signed provider events. Checkout takes the amount from the engagement's snapshot only. The browser never
-- activates anything. Owner terms (O-05, MEMORY.md): 15% fee, coach payout held 7 days.

-- The fee in whole paise, rounded half up: (gross * bps + 5000) / 10000.
create function public.fee_paise(gross bigint, bps smallint)
returns bigint
language sql
immutable
set search_path = ''
as $$
  select (gross * bps + 5000) / 10000;
$$;

-- How long a coach's payout waits after a payment, so a refund in the refund window comes out of FitSphere's hands.
create function public.payout_hold_days()
returns int
language sql
immutable
set search_path = ''
as $$
  select 7;
$$;

-- The last day of a month paid from start: the day before the same date next month, or the end of a shorter next
-- month (31 Jan runs to 28 Feb, not 27 Feb).
create function public.month_period_end(start date)
returns date
language sql
immutable
set search_path = ''
as $$
  select case when extract(day from start + interval '1 month') < extract(day from start)
    then (start + interval '1 month')::date else (start + interval '1 month')::date - 1 end;
$$;

-- Whether this database accepts the fake provider's payments. The local seed allows them; production never has the
-- row set, so a fake order cannot be paid there even if an app setting is wrong (a second guard to lib/payments).
create table public.payment_settings (
  id boolean primary key default true check (id),
  fake_allowed boolean not null default false
);
insert into public.payment_settings (id, fake_allowed) values (true, false);
alter table public.payment_settings enable row level security;
revoke all on public.payment_settings from anon, authenticated;
grant all on public.payment_settings to service_role;

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  engagement_id uuid not null references public.engagements (id),
  amount_paise bigint not null check (amount_paise between 1 and 100000000),
  currency text not null default 'INR' check (currency = 'INR'),
  -- Copied from the engagement, so a later fee change never alters this order.
  fee_bps smallint not null check (fee_bps between 0 and 10000),
  -- first: the payment that starts coaching (its period is set when the money arrives); renewal: M4-11.
  kind text not null default 'first' check (kind in ('first', 'renewal')),
  period_start date not null,
  period_end date not null check (period_end >= period_start),
  provider_order_id text unique check (char_length(provider_order_id) <= 64),
  status text not null default 'created' check (status in ('created', 'paid', 'expired', 'failed')),
  created_at timestamptz not null default now(),
  paid_at timestamptz
);
-- At most one open or paid order per engagement and period: no double charge for the same month.
create unique index orders_one_per_period on public.orders (engagement_id, period_start) where status in ('created', 'paid');
-- One open first-payment order per engagement, whatever day checkout opens: there is never a second one to pay.
create unique index orders_one_open_first on public.orders (engagement_id) where status = 'created' and kind = 'first';

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id),
  provider_payment_id text not null unique check (char_length(provider_payment_id) <= 64),
  amount_paise bigint not null check (amount_paise > 0),
  currency text not null check (currency = 'INR'),
  -- duplicate: money owed back (refunds, M4-12): a second capture, a capture on an expired order, or one after the
  -- engagement closed.
  status text not null check (status in ('captured', 'failed', 'refunded', 'duplicate')),
  captured_at timestamptz not null default now()
);
create index payments_order_idx on public.payments (order_id);

-- Every provider event, once. The unique event id is the first guard against a replayed or retried webhook.
create table public.payment_events (
  id bigint generated always as identity primary key,
  provider_event_id text not null unique check (char_length(provider_event_id) <= 100),
  type text not null check (char_length(type) <= 60),
  payload jsonb not null,
  received_at timestamptz not null default now(),
  result text check (result in ('applied', 'duplicate', 'ignored', 'error')),
  note text
);

create table public.payouts (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null unique references public.payments (id),
  coach_id uuid references public.profiles (id) on delete set null,
  gross_paise bigint not null check (gross_paise > 0),
  fee_paise bigint not null check (fee_paise >= 0),
  net_paise bigint not null,
  provider_transfer_id text unique,
  hold_until timestamptz not null,
  -- shortcut: manual payouts until Razorpay Route (M4-13); an admin marks them paid.
  status text not null default 'manual_due' check (status in ('pending', 'on_hold', 'processed', 'reversed', 'manual_due', 'manual_paid')),
  created_at timestamptz not null default now(),
  check (net_paise = gross_paise - fee_paise)
);
create index payouts_coach_idx on public.payouts (coach_id, status);

alter table public.orders enable row level security;
alter table public.payments enable row level security;
alter table public.payment_events enable row level security;
alter table public.payouts enable row level security;
revoke all on public.orders, public.payments, public.payment_events, public.payouts from anon, authenticated;
grant all on public.orders, public.payments, public.payment_events, public.payouts to service_role;
grant select on public.orders, public.payments, public.payouts to authenticated;
-- The athlete and coach of the engagement read its orders and payments; only the coach (and admins) read payouts.
create policy orders_select_party on public.orders for select to authenticated
  using (exists (select 1 from public.engagements g where g.id = engagement_id and (g.athlete_id = (select auth.uid()) or g.coach_id = (select auth.uid()))));
create policy payments_select_party on public.payments for select to authenticated
  using (exists (select 1 from public.orders o join public.engagements g on g.id = o.engagement_id
    where o.id = order_id and (g.athlete_id = (select auth.uid()) or g.coach_id = (select auth.uid()))));
create policy payouts_select_coach on public.payouts for select to authenticated using (coach_id = (select auth.uid()) or public.is_admin());

alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check
  check (kind in ('coach_feedback', 'new_lesson', 'session_reminder', 'request_accepted', 'payment_due', 'new_request', 'request_declined',
    'request_withdrawn', 'new_message', 'payment_received', 'new_client'));

-- Service role only: the server calls it after checking the signed-in athlete. Returns the open order for the
-- engagement's next period, made if needed. The amount and fee come from the engagement, never from the caller.
create function public.start_checkout(engagement uuid, athlete uuid)
returns table (order_id uuid, amount_paise bigint, provider_order_id text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  g public.engagements;
  ps date;
  pe date;
  o public.orders;
begin
  select * into g from public.engagements where id = engagement for update;
  if g.id is null or g.athlete_id is distinct from athlete or g.status <> 'accepted' then
    raise exception 'not_payable' using errcode = '22023';
  end if;
  -- A first estimate of the period; apply_payment_event sets it from the day the money arrives.
  ps := greatest(g.start_date, public.india_today());
  pe := case when g.package_kind = 'monthly' then public.month_period_end(ps) else ps end;
  select * into o from public.orders where orders.engagement_id = g.id and kind = 'first' and status = 'created';
  if o.id is null then
    insert into public.orders (engagement_id, amount_paise, fee_bps, period_start, period_end)
    values (g.id, g.price_paise, g.fee_bps, ps, pe) returning * into o;
  end if;
  return query select o.id, o.amount_paise, o.provider_order_id;
end;
$$;

-- Service role only: records the provider's order id, once, and returns the one attached. A second attach (a double
-- click) keeps the first, so both clicks go on to the same order.
create function public.attach_provider_order(order_ uuid, provider_order text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  attached text;
begin
  update public.orders set provider_order_id = provider_order where id = order_ and provider_order_id is null and status = 'created'
  returning provider_order_id into attached;
  if attached is null then
    select provider_order_id into attached from public.orders where id = order_;
  end if;
  if attached is null then
    raise exception 'not_open' using errcode = '22023';
  end if;
  return attached;
end;
$$;

-- Service role only: the one writer of money state, called by the verified webhook. One transaction:
-- record the event once, then apply only the transitions allowed here. Returns applied, duplicate or ignored.
create function public.apply_payment_event(event_id text, event_type text, body jsonb)
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
  if o.id is null or pid is null then
    update public.payment_events set result = 'ignored', note = 'unknown order' where id = ev;
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
  -- shortcut: renewal orders (kind 'renewal') arrive with M4-11.
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
  insert into public.payouts (payment_id, coach_id, gross_paise, fee_paise, net_paise, hold_until)
  values (pay, g.coach_id, amount, fee, amount - fee, now() + make_interval(days => public.payout_hold_days()));
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

-- One row per broken money rule. pgTAP runs it; the daily sweep will too (M4-11).
create function public.money_invariants()
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
  select 'capture event ignored', null::uuid from public.payment_events e where e.type = 'payment.captured' and e.result = 'ignored'
  union all
  select 'payout is not the payment less the fee', u.id from public.payouts u join public.payments p on p.id = u.payment_id join public.orders o on o.id = p.order_id
  where u.gross_paise <> p.amount_paise or u.fee_paise <> public.fee_paise(p.amount_paise, o.fee_bps);
$$;

revoke all on function public.fee_paise(bigint, smallint), public.payout_hold_days(), public.month_period_end(date) from public;
grant execute on function public.fee_paise(bigint, smallint), public.payout_hold_days(), public.month_period_end(date) to anon, authenticated, service_role;
revoke all on function public.start_checkout(uuid, uuid), public.attach_provider_order(uuid, text), public.apply_payment_event(text, text, jsonb),
  public.money_invariants() from public, anon, authenticated;
grant execute on function public.start_checkout(uuid, uuid), public.attach_provider_order(uuid, text), public.apply_payment_event(text, text, jsonb),
  public.money_invariants() to service_role;
