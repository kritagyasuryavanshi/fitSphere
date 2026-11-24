-- M4-17: booking a single 1:1 session (docs/plans/remaining-tasks-plan.md, agreed with Codex). The athlete of an
-- accepted single-session request holds a time for 15 minutes; checkout needs the hold, and the paid capture confirms
-- it. Times are instants (timestamptz); the coach's weekly windows are India time. An exclusion constraint keeps live
-- bookings of one coach from overlapping. A booked session is refundable until 24 hours before it starts. Single
-- sessions paid before this change (no booking) keep the old date rule.

create extension if not exists btree_gist with schema extensions;

-- How long a single session lasts. Monthly packages have no length.
alter table public.packages add column minutes smallint check (minutes between 15 and 240);
update public.packages set minutes = 60 where kind = 'single';

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  engagement_id uuid not null references public.engagements (id) on delete cascade,
  coach_id uuid not null references public.profiles (id) on delete cascade,
  athlete_id uuid references public.profiles (id) on delete set null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'held' check (status in ('held', 'confirmed', 'cancelled', 'refunded')),
  hold_expires_at timestamptz,
  order_id uuid references public.orders (id),
  created_at timestamptz not null default now(),
  check (ends_at > starts_at),
  -- Live bookings of one coach never overlap. Expired holds are cancelled by reserve_slot before it inserts.
  exclude using gist (coach_id with =, tstzrange(starts_at, ends_at) with &&) where (status in ('held', 'confirmed'))
);
create index bookings_engagement_idx on public.bookings (engagement_id);
alter table public.bookings enable row level security;
revoke all on public.bookings from anon, authenticated;
grant select on public.bookings to authenticated;
grant all on public.bookings to service_role;
create policy bookings_select_party on public.bookings for select to authenticated
  using (coach_id = (select auth.uid()) or athlete_id = (select auth.uid()) or public.is_admin());

-- The session length of a package, or an hour if the package is gone.
create function public.session_minutes(package uuid)
returns int
language sql
stable
set search_path = ''
as $$
  select coalesce((select p.minutes from public.packages p where p.id = package), 60);
$$;

-- Whether [starts_at, starts_at + minutes) lies inside one of the coach's weekly windows, in India time.
create function public.fits_availability(coach uuid, starts timestamptz, len int)
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (
    select 1 from public.availability_slots s
    where s.coach_id = coach
      and s.dow = extract(isodow from (starts at time zone 'Asia/Kolkata'))::int
      and (starts at time zone 'Asia/Kolkata')::time >= s.start_time
      and ((starts at time zone 'Asia/Kolkata') + make_interval(mins => len)) <= ((starts at time zone 'Asia/Kolkata')::date + s.start_time + make_interval(mins => s.minutes)));
$$;

-- The athlete holds a time for their accepted single-session request, for 15 minutes. Picking again replaces the hold.
create function public.reserve_slot(engagement uuid, starts timestamptz)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  g public.engagements;
  mins int;
  id_ uuid;
begin
  select * into g from public.engagements where id = engagement for update;
  if g.id is null or auth.uid() is null or g.athlete_id is distinct from auth.uid() then
    raise exception 'not_yours' using errcode = '42501';
  end if;
  if g.status <> 'accepted' or g.package_kind <> 'single' then
    raise exception 'not_bookable' using errcode = '22023';
  end if;
  if starts < now() + interval '48 hours' then
    raise exception 'too_soon' using errcode = '22023';
  end if;
  if starts > now() + interval '60 days' then
    raise exception 'too_far' using errcode = '22023';
  end if;
  -- The time cannot change while a payment for the held time may be under way (Codex review).
  if exists (select 1 from public.bookings b join public.orders o on o.id = b.order_id
      where b.engagement_id = g.id and b.status = 'held' and b.hold_expires_at > now() and o.status = 'created' and o.provider_order_id is not null) then
    raise exception 'checkout_open' using errcode = '22023';
  end if;
  mins := public.session_minutes(g.package_id);
  if not public.fits_availability(g.coach_id, starts, mins) then
    raise exception 'not_available' using errcode = '22023';
  end if;
  -- One booking at a time per coach, so expired holds are cleared and the new one checked in one go.
  perform 1 from public.coach_profiles where coach_id = g.coach_id for update;
  update public.bookings set status = 'cancelled'
  where (coach_id = g.coach_id and status = 'held' and hold_expires_at < now())
     or (engagement_id = g.id and status = 'held');
  begin
    insert into public.bookings (engagement_id, coach_id, athlete_id, starts_at, ends_at, hold_expires_at)
    values (g.id, g.coach_id, g.athlete_id, starts, starts + make_interval(mins => mins), now() + interval '15 minutes')
    returning id into id_;
  exception when exclusion_violation then
    raise exception 'slot_taken' using errcode = '22023';
  end;
  return id_;
end;
$$;

-- The athlete: free start times for their accepted single-session request over the next N days (at most 30), every
-- 30 minutes inside the coach's windows, at least 48 hours ahead, not overlapping a live booking.
create function public.open_slots(engagement uuid, days int default 14)
returns table (starts_at timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  g public.engagements;
  mins int;
begin
  select * into g from public.engagements where id = engagement;
  if g.id is null or auth.uid() is null or g.athlete_id is distinct from auth.uid() then
    raise exception 'not_yours' using errcode = '42501';
  end if;
  mins := public.session_minutes(g.package_id);
  return query
  select c.t from (
    select ((public.india_today() + d)::timestamp + s.start_time + make_interval(mins => 30 * k)) at time zone 'Asia/Kolkata' as t, s.minutes as win, k
    from generate_series(0, least(greatest(days, 1), 30)) d
    join public.availability_slots s on s.coach_id = g.coach_id and s.dow = extract(isodow from (public.india_today() + d))::int
    cross join generate_series(0, 15) k
  ) c
  where 30 * c.k + mins <= c.win
    and c.t >= now() + interval '48 hours'
    and not exists (select 1 from public.bookings b where b.coach_id = g.coach_id
      and (b.status = 'confirmed' or (b.status = 'held' and b.hold_expires_at > now() and b.engagement_id <> g.id))
      and tstzrange(b.starts_at, b.ends_at) && tstzrange(c.t, c.t + make_interval(mins => mins)))
  order by c.t
  limit 60;
end;
$$;

-- When coaching stops before or after the session, its booking stops holding the time.
create function public.release_booking_on_end()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.bookings set status = case when new.status = 'refunded' then 'refunded' else 'cancelled' end
  where engagement_id = new.id and (status = 'held'
    or (status = 'confirmed' and (new.status in ('refunded', 'declined', 'withdrawn', 'expired') or starts_at > now())));
  return null;
end;
$$;
create trigger engagements_release_booking after update of status on public.engagements for each row
  when (new.status in ('declined', 'withdrawn', 'expired', 'refunded', 'ended', 'lapsed') and old.status is distinct from new.status)
  execute function public.release_booking_on_end();

revoke all on function public.session_minutes(uuid), public.fits_availability(uuid, timestamptz, int), public.release_booking_on_end()
  from public, anon, authenticated;
revoke all on function public.reserve_slot(uuid, timestamptz), public.open_slots(uuid, int) from public, anon;
grant execute on function public.reserve_slot(uuid, timestamptz), public.open_slots(uuid, int) to authenticated;

-- start_checkout as in 20261209000000_payments.sql: a single session needs a live hold, and the order is for its day.
create or replace function public.start_checkout(engagement uuid, athlete uuid)
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
  b public.bookings;
begin
  select * into g from public.engagements where id = engagement for update;
  if g.id is null or g.athlete_id is distinct from athlete or g.status <> 'accepted' then
    raise exception 'not_payable' using errcode = '22023';
  end if;
  -- A single session needs a live hold on a time (M4-17); the order is for that day.
  if g.package_kind = 'single' then
    select * into b from public.bookings x where x.engagement_id = g.id and x.status = 'held' and x.hold_expires_at > now() for update;
    if b.id is null then
      raise exception 'needs_slot' using errcode = '22023';
    end if;
    ps := (b.starts_at at time zone 'Asia/Kolkata')::date;
    pe := ps;
  else
    -- A first estimate of the period; apply_payment_event sets it from the day the money arrives.
    ps := greatest(g.start_date, public.india_today());
    pe := public.month_period_end(ps);
  end if;
  select * into o from public.orders where orders.engagement_id = g.id and kind = 'first' and status = 'created';
  if o.id is null then
    insert into public.orders (engagement_id, amount_paise, fee_bps, period_start, period_end)
    values (g.id, g.price_paise, g.fee_bps, ps, pe) returning * into o;
  elsif o.period_start is distinct from ps then
    update public.orders set period_start = ps, period_end = pe where id = o.id returning * into o;
  end if;
  if b.id is not null then
    update public.bookings set order_id = o.id where id = b.id;
  end if;
  return query select o.id, o.amount_paise, o.provider_order_id;
end;
$$;

-- apply_payment_event as in 20261226000000_renewal_orders.sql: a booked session is confirmed by its capture.
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
  bk public.bookings;
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

  -- A booked single session (M4-17): the capture confirms the held time, or, if the hold was lost to someone else
  -- meanwhile, the money is owed back. Its payout waits until refunds close, 24 hours before the start.
  select * into bk from public.bookings x where x.order_id = o.id and x.status = 'held' order by x.created_at desc limit 1 for update;
  if bk.id is null then
    select * into bk from public.bookings x where x.order_id = o.id order by x.created_at desc limit 1 for update;
  end if;
  if bk.id is not null then
    -- A hold past its time (with 15 minutes' grace for a late webhook) or lost to someone else is not booked.
    if bk.status <> 'held' or bk.hold_expires_at < now() - interval '15 minutes' then
      insert into public.payments (order_id, provider_payment_id, amount_paise, currency, status) values (o.id, pid, amount, o.currency, 'duplicate');
      update public.payment_events set result = 'applied', note = 'owed back: the booked time was lost (' || bk.status || ')' where id = ev;
      return 'applied';
    end if;
    update public.bookings set status = 'confirmed', hold_expires_at = null where id = bk.id;
    o.period_start := (bk.starts_at at time zone 'Asia/Kolkata')::date;
    o.period_end := o.period_start;
    update public.orders set status = 'paid', paid_at = now(), period_start = o.period_start, period_end = o.period_end where id = o.id;
    insert into public.payments (order_id, provider_payment_id, amount_paise, currency, status) values (o.id, pid, amount, o.currency, 'captured')
    returning id into pay;
    update public.engagements set status = 'active', paid_through = o.period_end where id = g.id;
    fee := public.fee_paise(amount, o.fee_bps);
    insert into public.payouts (payment_id, coach_id, gross_paise, fee_paise, net_paise, hold_until)
    values (pay, g.coach_id, amount, fee, amount - fee, greatest(now() + make_interval(days => public.payout_hold_days()), bk.starts_at - interval '24 hours'));
    if g.athlete_id is not null then
      insert into public.notifications (user_id, kind, title, body, link, ref)
      values (g.athlete_id, 'payment_received', 'Payment received', 'We received your payment for ' || g.package_title || '. Your session is booked.', '/coaching', o.id::text)
      on conflict do nothing;
    end if;
    if g.coach_id is not null then
      insert into public.notifications (user_id, kind, title, body, link, ref)
      values (g.coach_id, 'new_client', 'New session booked',
        coalesce(nullif((select display_name from public.profiles where id = g.athlete_id), ''), 'An athlete') || ' booked and paid for ' || g.package_title || '.',
        '/coach/clients', o.id::text)
      on conflict do nothing;
    end if;
    update public.payment_events set result = 'applied' where id = ev;
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

-- refundable_payment as in 20261216000000_refunds.sql: a booked session until 24 hours before it starts.
create or replace function public.refundable_payment(g public.engagements)
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
      else coalesce((select bk.starts_at - interval '24 hours' > now() from public.bookings bk where bk.order_id = o.id and bk.status = 'confirmed' limit 1),
        o.period_start - 2 >= public.india_today()) end
  limit 1;
$$;
