-- M4-11a: monthly renewal, cancel and failed payments, with a fake subscription (docs/plans/m4-plan.md, section 2).
-- A monthly client's subscription renews through signed provider events, applied by the one writer of money state.
-- Cancel keeps coaching to the end of the paid month. A failed renewal warns, the provider retries, then a halt lapses
-- the coaching. A daily sweep ends coaching that ran out. Every change emails the athlete and the coach.
-- shortcut: the fake provider opens the subscription after the first payment; with Razorpay Subscriptions (M4-11b)
-- the first charge is the subscription's own.

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  engagement_id uuid not null unique references public.engagements (id),
  provider_subscription_id text not null unique check (char_length(provider_subscription_id) <= 64),
  -- active: renewing. pending: a renewal failed and the provider retries. halted: the provider gave up. cancelled.
  status text not null default 'active' check (status in ('active', 'pending', 'halted', 'cancelled')),
  created_at timestamptz not null default now()
);
alter table public.subscriptions enable row level security;
revoke all on public.subscriptions from anon, authenticated;
grant all on public.subscriptions to service_role;
grant select on public.subscriptions to authenticated;
create policy subscriptions_select_party on public.subscriptions for select to authenticated
  using (exists (select 1 from public.engagements g where g.id = engagement_id and (g.athlete_id = (select auth.uid()) or g.coach_id = (select auth.uid()))));

-- Why an athlete cancelled. Its own table, with no grant to anyone signed in: the coach reads engagements, and the
-- cancel screen promises the coach never sees this.
create table public.cancel_reasons (
  engagement_id uuid primary key references public.engagements (id),
  reason text not null check (reason in ('too_expensive', 'not_right_fit', 'taking_break', 'injury', 'other')),
  created_at timestamptz not null default now()
);
alter table public.cancel_reasons enable row level security;
revoke all on public.cancel_reasons from anon, authenticated;
grant all on public.cancel_reasons to service_role;

-- One email each to the athlete and the coach about a change to their coaching. The sender (lib/email.ts) writes the
-- text from the role and the other person's name.
create function public.queue_coaching_emails(g public.engagements, template_ text)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.email_outbox (user_id, to_email, template, data)
  select u.id, u.email, template_, jsonb_build_object('engagement', g.id, 'role', r.role,
    'other', coalesce(nullif(o.display_name, ''), ''), 'package', g.package_title, 'paid_through', g.paid_through, 'amount', g.price_paise)
  from (values ('athlete', g.athlete_id, g.coach_id), ('coach', g.coach_id, g.athlete_id)) r (role, who, other_id)
  join auth.users u on u.id = r.who
  left join public.profiles o on o.id = r.other_id;
$$;

-- The athlete cancels their monthly coaching. It runs to the end of the paid month, then the sweep ends it. Returns
-- the last paid day. The server then cancels the subscription at the provider.
create function public.cancel_coaching(engagement uuid, reason text default null)
returns date
language plpgsql
security definer
set search_path = ''
as $$
declare
  g public.engagements;
begin
  select * into g from public.engagements where id = engagement for update;
  if not found or auth.uid() is null or g.athlete_id is distinct from auth.uid() then
    raise exception 'not_yours' using errcode = '42501';
  end if;
  if reason is not null and reason not in ('too_expensive', 'not_right_fit', 'taking_break', 'injury', 'other') then
    raise exception 'bad_reason' using errcode = '22023';
  end if;
  if g.status <> 'active' or g.package_kind <> 'monthly' then
    raise exception 'not_cancellable' using errcode = '22023';
  end if;
  update public.engagements set status = 'cancelling', cancel_at_period_end = true where id = g.id returning * into g;
  if reason is not null then
    insert into public.cancel_reasons (engagement_id, reason) values (g.id, reason);
  end if;
  perform public.queue_coaching_emails(g, 'coaching_cancelled');
  return g.paid_through;
end;
$$;

-- Service role only: records the provider's subscription for an active monthly engagement, once, and returns the one
-- attached.
create function public.attach_subscription(engagement uuid, provider_subscription text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  g public.engagements;
begin
  select * into g from public.engagements where id = engagement for update;
  if not found or g.status <> 'active' or g.package_kind <> 'monthly' then
    raise exception 'not_monthly' using errcode = '22023';
  end if;
  insert into public.subscriptions (engagement_id, provider_subscription_id) values (g.id, provider_subscription)
  on conflict (engagement_id) do nothing;
  return (select provider_subscription_id from public.subscriptions where engagement_id = g.id);
end;
$$;

-- Subscription events, called only from apply_payment_event once the event is recorded. Returns applied or ignored.
create function public.apply_subscription_event(ev bigint, event_type text, body jsonb)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  sid text := body -> 'payload' -> 'subscription' -> 'entity' ->> 'id';
  p jsonb := body -> 'payload' -> 'payment' -> 'entity';
  pid text := p ->> 'id';
  amount bigint;
  s public.subscriptions;
  g public.engagements;
  o uuid;
  pay uuid;
  fee bigint;
  ps date;
  pe date;
begin
  select * into s from public.subscriptions where provider_subscription_id = sid for update;
  if s.id is null then
    update public.payment_events set result = 'ignored', note = 'unknown subscription' where id = ev;
    return 'ignored';
  end if;
  if sid like 'fake\_%' and not coalesce((select fake_allowed from public.payment_settings), false) then
    update public.payment_events set result = 'ignored', note = 'fake payments are off' where id = ev;
    return 'ignored';
  end if;
  select * into g from public.engagements where id = s.engagement_id for update;

  if event_type = 'subscription.charged' then
    begin
      amount := (p ->> 'amount')::bigint;
    exception when others then
      amount := null;
    end;
    if pid is null then
      update public.payment_events set result = 'ignored', note = 'no payment in the charge' where id = ev;
      return 'ignored';
    end if;
    if exists (select 1 from public.payments where provider_payment_id = pid) then
      update public.payment_events set result = 'ignored', note = 'payment already recorded' where id = ev;
      return 'ignored';
    end if;
    if amount is null or amount <= 0 or (p ->> 'currency') is distinct from 'INR' then
      update public.payment_events set result = 'ignored', note = 'amount or currency is not a valid INR charge' where id = ev;
      return 'ignored';
    end if;
    -- The next month starts the day after the last paid day, or today if a retry came late: the athlete never pays
    -- for days the coach could not see. A charge for a month not yet due (a second charge in one cycle) is owed back.
    ps := greatest(g.paid_through + 1, public.india_today());
    pe := public.month_period_end(ps);
    -- The next month, once. Anything else is money owed back: a wrong amount, coaching that is not renewing
    -- (cancelled, ended, lapsed, or its athlete deleted their account), or a month not yet due. Recorded, flagged by
    -- money_invariants, refunded in M4-12.
    if amount = g.price_paise and g.status = 'active' and g.package_kind = 'monthly' and g.athlete_id is not null
      and g.paid_through is not null and g.paid_through + 1 <= public.india_today() + 1 then
      insert into public.orders (engagement_id, amount_paise, fee_bps, kind, period_start, period_end, status, paid_at)
      values (g.id, amount, g.fee_bps, 'renewal', ps, pe, 'paid', now())
      on conflict (engagement_id, period_start) where status in ('created', 'paid') do nothing
      returning id into o;
    end if;
    if o is null then
      -- A failed order holds the money owed back, so the payment has an order without claiming a month.
      insert into public.orders (engagement_id, amount_paise, fee_bps, kind, period_start, period_end, status)
      values (g.id, amount, g.fee_bps, 'renewal', coalesce(ps, public.india_today()), coalesce(pe, public.india_today()), 'failed')
      returning id into o;
      insert into public.payments (order_id, provider_payment_id, amount_paise, currency, status) values (o, pid, amount, 'INR', 'duplicate');
      update public.payment_events set result = 'applied', note = 'owed back: engagement ' || coalesce(g.status, 'gone')
        || case when amount <> g.price_paise then ', wrong amount' else '' end where id = ev;
      return 'applied';
    end if;
    insert into public.payments (order_id, provider_payment_id, amount_paise, currency, status) values (o, pid, amount, 'INR', 'captured')
    returning id into pay;
    update public.engagements set paid_through = pe where id = g.id returning * into g;
    update public.subscriptions set status = 'active' where id = s.id;
    fee := public.fee_paise(amount, g.fee_bps);
    insert into public.payouts (payment_id, coach_id, gross_paise, fee_paise, net_paise, hold_until)
    values (pay, g.coach_id, amount, fee, amount - fee, now() + make_interval(days => public.payout_hold_days()));
    if g.athlete_id is not null then
      insert into public.notifications (user_id, kind, title, body, link, ref)
      values (g.athlete_id, 'payment_received', 'Payment received', 'We received your payment for ' || g.package_title || '. Coaching runs ' || ps || ' to ' || pe || '.',
        '/coaching', o::text)
      on conflict do nothing;
    end if;
    perform public.queue_coaching_emails(g, 'coaching_renewed');
  elsif event_type = 'subscription.pending' then
    -- The renewal failed and the provider retries. Access lasts to the last paid day.
    if g.status <> 'active' or g.paid_through >= public.india_today() then
      update public.payment_events set result = 'ignored', note = 'coaching is not active, or already paid to today' where id = ev;
      return 'ignored';
    end if;
    update public.subscriptions set status = 'pending' where id = s.id;
    if g.athlete_id is not null then
      insert into public.notifications (user_id, kind, title, body, link, ref)
      values (g.athlete_id, 'payment_due', 'Payment failed', 'Your payment for ' || g.package_title || ' did not go through. We will try again.',
        '/coaching', s.id::text || ':' || coalesce(g.paid_through::text, ''))
      on conflict do nothing;
    end if;
    perform public.queue_coaching_emails(g, 'renewal_failed');
  elsif event_type = 'subscription.halted' then
    -- The provider gave up retrying: the coaching lapses, and the programs the coach assigned end with it.
    if g.status <> 'active' then
      update public.subscriptions set status = 'halted' where id = s.id;
      update public.payment_events set result = 'ignored', note = 'coaching is not active' where id = ev;
      return 'ignored';
    end if;
    update public.subscriptions set status = 'halted' where id = s.id;
    update public.engagements set status = 'lapsed', ended_at = now() where id = g.id returning * into g;
    perform public.queue_coaching_emails(g, 'coaching_lapsed');
  elsif event_type = 'subscription.cancelled' then
    update public.subscriptions set status = 'cancelled' where id = s.id;
  else
    update public.payment_events set result = 'ignored', note = 'event type not handled yet' where id = ev;
    return 'ignored';
  end if;
  update public.payment_events set result = 'applied' where id = ev;
  return 'applied';
end;
$$;

-- Service role only, once a day: ends coaching that ran out (a cancelled month, a single session, or monthly coaching
-- with nothing renewing it), and lapses a renewal the provider has been silent on for a week. Returns how many changed.
create function public.sweep_engagements()
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  g public.engagements;
  renewing boolean;
  n int := 0;
begin
  for g in
    select * from public.engagements e
    where e.status in ('active', 'cancelling') and e.paid_through < public.india_today()
    for update skip locked
  loop
    renewing := g.status = 'active' and g.package_kind = 'monthly'
      and exists (select 1 from public.subscriptions s where s.engagement_id = g.id and s.status in ('active', 'pending'));
    if renewing and g.paid_through >= public.india_today() - 7 then
      continue; -- the provider is still retrying
    end if;
    update public.engagements set status = case when renewing then 'lapsed' else 'ended' end, ended_at = now() where id = g.id returning * into g;
    perform public.queue_coaching_emails(g, case when renewing then 'coaching_lapsed' else 'coaching_ended' end);
    n := n + 1;
  end loop;
  return n;
end;
$$;

-- Service role only, from the daily cron: subscriptions still renewing although their coaching stopped (cancelled,
-- ended, lapsed, or the athlete's account deleted). The cron cancels each at the provider, then marks it cancelled.
-- This also retries a cancel the provider failed at the moment the athlete cancelled.
create function public.subscriptions_to_stop()
returns table (subscription_id uuid, provider_subscription_id text)
language sql
stable
security definer
set search_path = ''
as $$
  select s.id, s.provider_subscription_id from public.subscriptions s join public.engagements g on g.id = s.engagement_id
  where s.status in ('active', 'pending') and (g.status <> 'active' or g.athlete_id is null);
$$;

-- Service role only: the provider stopped this subscription.
create function public.mark_subscription_cancelled(subscription uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.subscriptions set status = 'cancelled' where id = subscription;
$$;

-- engagement_opens as in 20261213000100_paid_access.sql, plus one day of grace while the subscription renews: the
-- renewal charge lands some time on the day after the last paid day, and the coach should not lose access meanwhile.
create or replace function public.engagement_opens(g public.engagements)
returns boolean
language sql
stable
set search_path = ''
as $$
  select g.status in ('active', 'cancelling') and g.share_data and (g.paid_through >= public.india_today()
    or (g.status = 'active' and g.paid_through = public.india_today() - 1
      and exists (select 1 from public.subscriptions s where s.engagement_id = g.id and s.status = 'active')));
$$;

-- apply_payment_event as in 20261209000000_payments.sql, handing subscription events to apply_subscription_event.
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


-- export_my_data as in 20261212000000_ask_ai.sql, plus the athlete's cancel reasons.
create or replace function public.export_my_data()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'sign in first' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'exported_at', now(),
    'email', (select email from auth.users where id = uid),
    'profile', (select to_jsonb(p) from public.profiles p where p.id = uid),
    'roles', coalesce((select jsonb_agg(r.role order by r.role) from public.user_roles r where r.user_id = uid), '[]'),
    'sports', coalesce((select jsonb_agg(jsonb_build_object('sport', a.category_id, 'answers', a.answers)) from public.athlete_prefs a where a.user_id = uid), '[]'),
    'training', (select to_jsonb(b) - 'user_id' from public.athlete_basics b where b.user_id = uid),
    'body_metrics', coalesce((select jsonb_agg(to_jsonb(m) - 'user_id' order by m.measured_at) from public.body_metrics m where m.user_id = uid), '[]'),
    'consents', coalesce((select jsonb_agg(to_jsonb(c) - 'user_id' order by c.created_at) from public.consents c where c.user_id = uid), '[]'),
    'coach_applications', coalesce((select jsonb_agg(to_jsonb(x) - 'user_id' - 'decided_by' order by x.created_at) from public.coach_applications x where x.user_id = uid), '[]'),
    'saved', coalesce((select jsonb_agg(jsonb_build_object('item', c.slug, 'at', s.created_at) order by s.created_at)
      from public.saves s join public.content_items c on c.id = s.item_id where s.user_id = uid), '[]'),
    'completed', coalesce((select jsonb_agg(jsonb_build_object('item', c.slug, 'at', s.created_at) order by s.created_at)
      from public.completions s join public.content_items c on c.id = s.item_id where s.user_id = uid), '[]'),
    'programs', coalesce((select jsonb_agg(jsonb_build_object('program', coalesce((select v.title from public.program_versions v where v.id = public.version_in_effect(p.id, public.india_today())), ''), 'status', e.status, 'start_date', e.start_date,
        'joined_at', e.joined_at, 'ended_at', e.ended_at) order by e.joined_at)
      from public.enrollments e join public.programs p on p.id = e.program_id where e.athlete_id = uid), '[]'),
    'training_logs', coalesce((select jsonb_agg(to_jsonb(l) - 'athlete_id' || jsonb_build_object('items',
        coalesce((select jsonb_agg(to_jsonb(i) - 'log_id' || jsonb_build_object('sets',
            coalesce((select jsonb_agg(to_jsonb(x) - 'item_log_id' order by x.set_no) from public.set_logs x where x.item_log_id = i.id), '[]'))
          order by i.position) from public.item_logs i where i.log_id = l.id), '[]'))
        order by l.on_date, l.started_at)
      from public.session_logs l where l.athlete_id = uid), '[]'),
    'feedback', coalesce((select jsonb_agg(jsonb_build_object('at', f.created_at, 'coach', f.coach_name, 'program', f.program_title, 'body', f.body,
        'replies', coalesce((select jsonb_agg(jsonb_build_object('at', r.created_at, 'body', r.body) order by r.created_at) from public.feedback_replies r where r.feedback_id = f.id), '[]'))
        order by f.created_at)
      from public.feedback f where f.athlete_id = uid), '[]'),
    'email_prefs', (select to_jsonb(p) - 'user_id' from public.email_prefs p where p.user_id = uid),
    'notifications', coalesce((select jsonb_agg(jsonb_build_object('kind', n.kind, 'title', n.title, 'body', n.body, 'at', n.created_at, 'read_at', n.read_at) order by n.created_at)
      from public.notifications n where n.user_id = uid), '[]'),
    'coach', (select to_jsonb(cp) - 'coach_id' - 'payout_account_id' || jsonb_build_object(
        'packages', coalesce((select jsonb_agg(to_jsonb(p) - 'coach_id' order by p.created_at) from public.packages p where p.coach_id = uid), '[]'),
        'slots', coalesce((select jsonb_agg(to_jsonb(a) - 'coach_id' - 'id' order by a.dow, a.start_time) from public.availability_slots a where a.coach_id = uid), '[]'),
        'credentials', coalesce((select jsonb_agg(to_jsonb(c) - 'coach_id' - 'decided_by' order by c.created_at) from public.credentials c where c.coach_id = uid), '[]'))
      from public.coach_profiles cp where cp.coach_id = uid),
    'coaching', coalesce((select jsonb_agg(jsonb_build_object('coach', coalesce(nullif(p.display_name, ''), 'Coach'), 'package', g.package_title,
        'price_paise', g.price_paise, 'start_date', g.start_date, 'days_per_week', g.days_per_week, 'goals', g.goals, 'share_data', g.share_data,
        'status', g.status, 'requested_at', g.created_at, 'decided_at', g.decided_at, 'ended_at', g.ended_at,
        'cancel_reason', (select r.reason from public.cancel_reasons r where r.engagement_id = g.id)) order by g.created_at)
      from public.engagements g left join public.profiles p on p.id = g.coach_id where g.athlete_id = uid), '[]'),
    'messages', coalesce((select jsonb_agg(jsonb_build_object('conversation', c.id,
        'from', case when m.sender_id = uid then 'You' else coalesce(nullif(p.display_name, ''), case when c.coach_id = m.sender_id then 'Coach' else 'Athlete' end) end,
        'body', m.body, 'at', m.created_at) order by c.id, m.id)
      from public.messages m join public.conversations c on c.id = m.conversation_id
      left join public.profiles p on p.id = m.sender_id
      where c.athlete_id = uid or c.coach_id = uid), '[]'),
    'ai_questions', coalesce((select jsonb_agg(jsonb_build_object('asked_on', q.asked_on, 'question', q.question, 'answer', q.answer ->> 'text',
        'kind', q.kind, 'at', q.created_at) order by q.created_at)
      from public.ai_questions q where q.user_id = uid), '[]'),
    'pain_reports', coalesce((select jsonb_agg(jsonb_build_object('on', p.reported_on, 'source', p.source) order by p.created_at)
      from public.pain_reports p where p.athlete_id = uid), '[]'),
    'added_to_today', coalesce((select jsonb_agg(jsonb_build_object('on', t.on_date, 'item', c.slug) order by t.created_at)
      from public.today_extras t join public.content_items c on c.id = t.item_id where t.athlete_id = uid), '[]'),
    'shortlist', coalesce((select jsonb_agg(jsonb_build_object('coach', s.coach_id, 'at', s.created_at) order by s.created_at)
      from public.shortlists s where s.athlete_id = uid), '[]'),
    'account_created_at', (select created_at from auth.users where id = uid),
    'last_sign_in_at', (select last_sign_in_at from auth.users where id = uid),
    'queued_emails', coalesce((select jsonb_agg(jsonb_build_object('to', o.to_email, 'template', o.template, 'data', o.data, 'created_at', o.created_at, 'sent_at', o.sent_at) order by o.id)
      from public.email_outbox o where o.user_id = uid or lower(o.to_email) = lower((select email from auth.users where id = uid))), '[]'),
    -- Role changes about the person, by action and time; the other party shows only as an id.
    'audit_events', coalesce((select jsonb_agg(jsonb_build_object('action', l.action, 'details', l.details, 'at', l.created_at) order by l.id)
      from public.audit_log l where l.target_id = uid), '[]')
  );
end;
$$;

-- money_invariants as in 20261209000000_payments.sql; an ignored renewal charge is flagged like an ignored capture.
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
  where u.gross_paise <> p.amount_paise or u.fee_paise <> public.fee_paise(p.amount_paise, o.fee_bps);
$$;


revoke all on function public.queue_coaching_emails(public.engagements, text), public.apply_subscription_event(bigint, text, jsonb)
  from public, anon, authenticated;
revoke all on function public.cancel_coaching(uuid, text) from public, anon;
grant execute on function public.cancel_coaching(uuid, text) to authenticated;
revoke all on function public.attach_subscription(uuid, text), public.sweep_engagements(), public.subscriptions_to_stop(),
  public.mark_subscription_cancelled(uuid) from public, anon, authenticated;
grant execute on function public.attach_subscription(uuid, text), public.sweep_engagements(), public.subscriptions_to_stop(),
  public.mark_subscription_cancelled(uuid) to service_role;
