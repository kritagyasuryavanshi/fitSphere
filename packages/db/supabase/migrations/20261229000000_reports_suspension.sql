-- M4-18: reports, the admin queue and suspension (docs/plans/remaining-tasks-plan.md, agreed with Codex; the owner
-- approved building it on the plan's rules on 2026-11-23). Anyone reports a review, a message or a coach. An admin
-- reads a reported message with up to 5 messages on each side, each read logged; hides a review; suspends a coach.
-- Suspension ends the coach's running coaching at once and refunds the unused days pro rata: the only partial refund.
-- The coach's payout is cut by the same share, or recorded as a debt when it was already paid.

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references public.profiles (id) on delete set null,
  target_kind text not null check (target_kind in ('review', 'message', 'coach')),
  -- A uuid for a review or a coach, a number for a message.
  target_id text not null check (char_length(target_id) <= 64),
  reason text not null check (reason in ('harassment', 'spam', 'unsafe_advice', 'fake', 'off_platform_payment', 'other')),
  note text check (char_length(note) <= 500),
  status text not null default 'open' check (status in ('open', 'resolved', 'dismissed')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references public.profiles (id) on delete set null
);
create unique index reports_one_open on public.reports (reporter_id, target_kind, target_id) where status = 'open';
create index reports_open_idx on public.reports (status, created_at);
alter table public.reports enable row level security;
revoke all on public.reports from anon, authenticated;
grant select on public.reports to authenticated;
grant all on public.reports to service_role;
create policy reports_select_own on public.reports for select to authenticated using (reporter_id = (select auth.uid()) or public.is_admin());
create trigger write_cap before insert on public.reports for each row execute function public.cap_writes('reporter_id', '10', '1 day');

-- What a coach owes back after a refund of money already paid out to them. Settled by hand.
create table public.coach_debts (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid references public.profiles (id) on delete set null,
  payout_id uuid not null references public.payouts (id),
  amount_paise bigint not null check (amount_paise > 0),
  note text check (char_length(note) <= 300),
  created_at timestamptz not null default now(),
  settled_at timestamptz
);
alter table public.coach_debts enable row level security;
revoke all on public.coach_debts from anon, authenticated;
grant select on public.coach_debts to authenticated;
grant all on public.coach_debts to service_role;
create policy coach_debts_select on public.coach_debts for select to authenticated using (coach_id = (select auth.uid()) or public.is_admin());

-- Suspension refunds may be partial; every other refund stays full (money_invariants checks both).
alter table public.refunds drop constraint refunds_reason_check;
alter table public.refunds add constraint refunds_reason_check check (reason in ('first_payment', 'owed_back', 'admin', 'suspension'));

-- Anyone signed in reports something they can see. Reporting the same thing again returns the open report.
create function public.report_content(kind text, target text, reason text, note text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  id_ uuid;
begin
  if uid is null then
    raise exception 'sign in first' using errcode = '42501';
  end if;
  if reason is null or reason not in ('harassment', 'spam', 'unsafe_advice', 'fake', 'off_platform_payment', 'other') then
    raise exception 'bad_reason' using errcode = '22023';
  end if;
  if kind = 'message' then
    if not exists (select 1 from public.messages m join public.conversations c on c.id = m.conversation_id
        where m.id = (case when target ~ '^[0-9]{1,18}$' then target::bigint end) and (c.athlete_id = uid or c.coach_id = uid)) then
      raise exception 'not_yours' using errcode = '42501';
    end if;
  elsif kind = 'review' then
    if not exists (select 1 from public.reviews r where r.id = (case when public.is_uuid_text(target) then target::uuid end) and public.review_visible(r)) then
      raise exception 'not_found' using errcode = '22023';
    end if;
  elsif kind = 'coach' then
    if not exists (select 1 from public.coach_profiles p where p.coach_id = (case when public.is_uuid_text(target) then target::uuid end) and p.status = 'live') then
      raise exception 'not_found' using errcode = '22023';
    end if;
  else
    raise exception 'bad_kind' using errcode = '22023';
  end if;
  select r.id into id_ from public.reports r where r.reporter_id = uid and r.target_kind = kind and r.target_id = target and r.status = 'open';
  if id_ is null then
    insert into public.reports (reporter_id, target_kind, target_id, reason, note) values (uid, kind, target, reason, left(nullif(btrim(note), ''), 500))
    returning id into id_;
  end if;
  return id_;
end;
$$;

create function public.is_uuid_text(t text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select t ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
$$;

-- Admins: the open reports, oldest first, with a short summary of what was reported.
create function public.admin_reports()
returns table (id uuid, target_kind text, target_id text, reason text, note text, created_at timestamptz, summary text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'admins only' using errcode = '42501';
  end if;
  return query
  select r.id, r.target_kind, r.target_id, r.reason, r.note, r.created_at,
    case r.target_kind
      when 'review' then (select left(v.body, 200) from public.reviews v where v.id = (case when public.is_uuid_text(r.target_id) then r.target_id::uuid end))
      when 'coach' then (select coalesce(nullif(p.display_name, ''), 'A coach') from public.profiles p where p.id = (case when public.is_uuid_text(r.target_id) then r.target_id::uuid end))
      else 'A message: open it to read it with the messages around it'
    end
  from public.reports r where r.status = 'open'
  order by r.created_at;
end;
$$;

-- Admins: a reported message with up to 5 messages before and after it in the same chat. Every read is logged.
create function public.admin_report_context(report uuid)
returns table (message_id bigint, sender_name text, body text, created_at timestamptz, reported boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.reports;
  m public.messages;
begin
  if not public.is_admin() then
    raise exception 'admins only' using errcode = '42501';
  end if;
  select * into r from public.reports x where x.id = report;
  if r.id is null or r.target_kind <> 'message' then
    raise exception 'not_a_message_report' using errcode = '22023';
  end if;
  select * into m from public.messages x where x.id = r.target_id::bigint;
  insert into public.audit_log (actor_id, action, target_id, details) values (auth.uid(), 'report_context_read', r.id, jsonb_build_object('message', r.target_id));
  if m.id is null then
    return;
  end if;
  return query
  select x.id, coalesce(nullif(p.display_name, ''), 'Someone'), x.body, x.created_at, x.id = m.id
  from (
    (select * from public.messages b where b.conversation_id = m.conversation_id and b.id < m.id order by b.id desc limit 5)
    union all select m.*
    union all (select * from public.messages a where a.conversation_id = m.conversation_id and a.id > m.id order by a.id limit 5)
  ) x
  left join public.profiles p on p.id = x.sender_id
  order by x.id;
end;
$$;

-- Admins: close a report.
create function public.admin_resolve_report(report uuid, outcome text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'admins only' using errcode = '42501';
  end if;
  if outcome not in ('resolved', 'dismissed') then
    raise exception 'bad_outcome' using errcode = '22023';
  end if;
  update public.reports set status = outcome, resolved_at = now(), resolved_by = auth.uid() where id = report and status = 'open';
  insert into public.audit_log (actor_id, action, target_id, details) values (auth.uid(), 'report_' || outcome, report, '{}');
end;
$$;

-- Admins: hide a review. It leaves the profile and the rating; its open reports are resolved.
create function public.admin_hide_review(review uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'admins only' using errcode = '42501';
  end if;
  update public.reviews set hidden_at = coalesce(hidden_at, now()) where id = review;
  update public.reports set status = 'resolved', resolved_at = now(), resolved_by = auth.uid()
  where target_kind = 'review' and target_id = review::text and status = 'open';
  insert into public.audit_log (actor_id, action, target_id, details) values (auth.uid(), 'review_hidden', review, '{}');
end;
$$;

-- Cuts the coach's payout for a processed partial refund: the same share of gross, fee and net. A payout already
-- paid stays as it is, and the net share becomes a coach debt instead.
create function public.cut_payout_for_refund(payment uuid, refund_paise bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  u public.payouts;
  net_cut bigint;
begin
  select * into u from public.payouts where payment_id = payment for update;
  if u.id is null or u.status = 'reversed' then
    return;
  end if;
  net_cut := (u.net_paise * refund_paise) / u.gross_paise;
  if u.status in ('manual_paid', 'processed') then
    if net_cut > 0 then
      insert into public.coach_debts (coach_id, payout_id, amount_paise, note) values (u.coach_id, u.id, net_cut, 'suspension refund after the payout');
    end if;
  elsif refund_paise >= u.gross_paise then
    update public.payouts set status = 'reversed' where id = u.id;
  else
    update public.payouts set gross_paise = gross_paise - refund_paise, fee_paise = fee_paise - (refund_paise - net_cut), net_paise = net_paise - net_cut
    where id = u.id;
  end if;
end;
$$;

-- Admins: suspend a coach. First every running coaching with them ends today, and each paid period still to come
-- is refunded pro rata (unused days over days in the period, rounded down to the paisa). Then the profile is
-- suspended, which declines open requests (stop_coach_renewals). Open reports about the coach are resolved.
create function public.admin_suspend_coach(coach uuid, why text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  p public.coach_profiles;
  g public.engagements;
  o public.orders;
  pay public.payments;
  unused int;
  amount bigint;
  today date := public.india_today();
begin
  if not public.is_admin() then
    raise exception 'admins only' using errcode = '42501';
  end if;
  if btrim(coalesce(why, '')) = '' then
    raise exception 'reason_required' using errcode = '22023';
  end if;
  select * into p from public.coach_profiles where coach_id = coach for update;
  if p.coach_id is null or p.status = 'suspended' then
    raise exception 'not_suspendable' using errcode = '22023';
  end if;
  for g in select * from public.engagements e where e.coach_id = coach and e.status in ('active', 'cancelling') order by e.id for update loop
    for o in select * from public.orders x where x.engagement_id = g.id and x.status = 'paid' and x.period_end > today order by x.period_start for update loop
      select * into pay from public.payments y where y.order_id = o.id and y.status = 'captured' for update;
      continue when pay.id is null
        or exists (select 1 from public.refunds z where z.payment_id = pay.id and z.status in ('requested', 'processed'));
      unused := o.period_end - greatest(o.period_start - 1, today);
      amount := (o.amount_paise * unused) / (o.period_end - o.period_start + 1);
      if amount > 0 then
        insert into public.refunds (payment_id, amount_paise, reason, requested_by, note)
        values (pay.id, amount, 'suspension', auth.uid(), left('Coach suspended: ' || btrim(why), 500));
      end if;
    end loop;
    update public.engagements set status = 'ended', paid_through = least(paid_through, today), ended_at = now() where id = g.id returning * into g;
    perform public.queue_coaching_emails(g, 'coaching_suspended');
  end loop;
  update public.coach_profiles set status = 'suspended' where coach_id = coach;
  update public.reports set status = 'resolved', resolved_at = now(), resolved_by = auth.uid()
  where target_kind = 'coach' and target_id = coach::text and status = 'open';
  insert into public.audit_log (actor_id, action, target_id, details) values (auth.uid(), 'coach_suspended', coach, jsonb_build_object('reason', left(btrim(why), 500)));
end;
$$;

-- Admins: lift a suspension. The profile is live again; ended coaching does not restart.
create function public.admin_unsuspend_coach(coach uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'admins only' using errcode = '42501';
  end if;
  update public.coach_profiles set status = 'live' where coach_id = coach and status = 'suspended';
  if not found then
    raise exception 'not_suspended' using errcode = '22023';
  end if;
  insert into public.audit_log (actor_id, action, target_id, details) values (auth.uid(), 'coach_unsuspended', coach, '{}');
end;
$$;

revoke all on function public.report_content(text, text, text, text), public.admin_reports(), public.admin_report_context(uuid),
  public.admin_resolve_report(uuid, text), public.admin_hide_review(uuid), public.admin_suspend_coach(uuid, text), public.admin_unsuspend_coach(uuid)
  from public, anon;
grant execute on function public.report_content(text, text, text, text), public.admin_reports(), public.admin_report_context(uuid),
  public.admin_resolve_report(uuid, text), public.admin_hide_review(uuid), public.admin_suspend_coach(uuid, text), public.admin_unsuspend_coach(uuid)
  to authenticated;
revoke all on function public.cut_payout_for_refund(uuid, bigint) from public, anon, authenticated;
grant execute on function public.is_uuid_text(text) to anon, authenticated, service_role;

-- apply_refund_event as in 20261216000000_refunds.sql: the amount is checked against the refund asked for, and a
-- partial suspension refund cuts the payout instead of refunding the payment.
create or replace function public.apply_refund_event(ev bigint, event_type text, body jsonb)
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
  -- Locks in one order everywhere: the order, the engagement, then the payment. apply_payment_event takes the order
  -- then the engagement; request_refund takes the engagement then the payment.
  select o2.* into o from public.payments p2 join public.orders o2 on o2.id = p2.order_id where p2.provider_payment_id = pid;
  if o.id is not null then
    perform 1 from public.orders where id = o.id for update;
    perform 1 from public.engagements where id = o.engagement_id for update;
  end if;
  select * into pay from public.payments where provider_payment_id = pid for update;
  if pay.id is null then
    update public.payment_events set result = 'ignored', note = 'unknown payment' where id = ev;
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
  -- The amount must be the refund we asked for (a suspension refund can be partial), or the full payment for one made
  -- at the provider's dashboard.
  if amount is distinct from coalesce(r.amount_paise, pay.amount_paise) or (e ->> 'currency') is distinct from pay.currency then
    update public.payment_events set result = 'ignored', note = 'amount does not match the refund' where id = ev;
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
  -- A partial (suspension) refund: the payment stays captured, the coaching already ended at the suspension, and the
  -- payout is cut by the same share (M4-18).
  if r.amount_paise < pay.amount_paise then
    perform public.cut_payout_for_refund(pay.id, r.amount_paise);
    if athlete is not null then
      insert into public.notifications (user_id, kind, title, body, link, ref)
      values (athlete, 'refund_processed', 'Refund sent', 'We refunded the unused days of your coaching. Your bank can take 5 to 7 working days to show it.', '/coaching', r.id::text)
      on conflict do nothing;
    end if;
    insert into public.audit_log (actor_id, action, target_id, details) values (null, 'refund_processed', athlete,
      jsonb_build_object('refund', r.id, 'payment', pay.id, 'amount_paise', r.amount_paise, 'reason', r.reason));
    update public.payment_events set result = 'applied' where id = ev;
    return 'applied';
  end if;
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

-- money_invariants as in 20261216000000_refunds.sql, allowing the partial suspension refund and checking its payout.
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
  where (u.gross_paise <> p.amount_paise or u.fee_paise <> public.fee_paise(p.amount_paise, o.fee_bps))
    and not exists (select 1 from public.refunds r where r.payment_id = p.id and r.reason = 'suspension' and r.status = 'processed')
  union all
  -- M4-18: after a partial suspension refund an unpaid payout keeps only the share of the money kept.
  select 'payout does not match the money kept after a suspension refund', u.id from public.payouts u join public.payments p on p.id = u.payment_id
    join public.refunds r on r.payment_id = p.id and r.reason = 'suspension' and r.status = 'processed' and r.amount_paise < p.amount_paise
  where u.status in ('pending', 'on_hold', 'manual_due') and u.gross_paise <> p.amount_paise - r.amount_paise
  union all
  select 'refund failed', r.id from public.refunds r
  where r.status = 'failed' and not exists (select 1 from public.refunds x where x.payment_id = r.payment_id and x.status in ('requested', 'processed'))
  union all
  select 'refund waiting over a day', r.id from public.refunds r where r.status = 'requested' and r.created_at < now() - interval '1 day'
  union all
  select 'refund is not the full payment', r.id from public.refunds r join public.payments p on p.id = r.payment_id
  where r.amount_paise <> p.amount_paise and r.reason <> 'suspension'
  union all
  select 'suspension refund larger than the payment', r.id from public.refunds r join public.payments p on p.id = r.payment_id
  where r.reason = 'suspension' and r.amount_paise > p.amount_paise
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

-- Admins: the money rules that are broken now (money_invariants itself is for the service role and the cron).
create function public.admin_money_issues()
returns table (rule text, ref uuid)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'admins only' using errcode = '42501';
  end if;
  return query select m.rule, m.ref from public.money_invariants() m;
end;
$$;
revoke all on function public.admin_money_issues() from public, anon;
grant execute on function public.admin_money_issues() to authenticated;
