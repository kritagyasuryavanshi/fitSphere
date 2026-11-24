-- M4-13 phase a: manual payouts (docs/plans/remaining-tasks-plan.md). Until Razorpay Route, an admin pays each coach
-- by bank transfer and records it here. A payout is ready only after its hold and while no refund is asked or done.
-- Marking it paid locks the payment row first, as request_refund and admin_refund do, so the two cannot cross.
-- The 15% fee is provisional until a CA confirms it (Decision 4): coaches see estimates, and live payouts wait.

alter table public.payouts
  add column paid_at timestamptz,
  add column paid_ref text check (char_length(paid_ref) <= 100),
  add column paid_by uuid references public.profiles (id) on delete set null,
  add column failed_note text check (char_length(failed_note) <= 300);

-- Whether a payout may be paid now: due, past its hold, its payment captured, and no refund asked or done.
create function public.payout_ready(payout uuid)
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce((select u.status = 'manual_due' and u.hold_until <= now()
    and exists (select 1 from public.payments p where p.id = u.payment_id and p.status = 'captured')
    and not exists (select 1 from public.refunds r where r.payment_id = u.payment_id and r.status in ('requested', 'processed'))
    from public.payouts u where u.id = payout), false);
$$;

-- Admins: the payouts ready to transfer, oldest first.
create function public.admin_payouts_due()
returns table (payout_id uuid, coach_id uuid, coach_name text, net_paise bigint, hold_until timestamptz, failed_note text)
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
  select u.id, u.coach_id, coalesce(nullif(pr.display_name, ''), 'A coach'), u.net_paise, u.hold_until, u.failed_note
  from public.payouts u left join public.profiles pr on pr.id = u.coach_id
  where public.payout_ready(u.id)
  order by u.hold_until;
end;
$$;

-- Admins: record a bank transfer, with its reference (UTR). Re-checks readiness under the payment lock.
create function public.admin_mark_payout_paid(payout uuid, reference text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  ref text := btrim(coalesce(reference, ''));
  u public.payouts;
begin
  if not public.is_admin() then
    raise exception 'admins only' using errcode = '42501';
  end if;
  if ref = '' or char_length(ref) > 100 then
    raise exception 'reference_required' using errcode = '22023';
  end if;
  perform 1 from public.payments p where p.id = (select payment_id from public.payouts where id = payout) for update;
  select * into u from public.payouts where id = payout for update;
  if u.id is null or u.status <> 'manual_due' then
    raise exception 'not_due' using errcode = '22023';
  end if;
  if u.hold_until > now() then
    raise exception 'on_hold' using errcode = '22023';
  end if;
  if not public.payout_ready(u.id) then
    raise exception 'refund_open' using errcode = '22023';
  end if;
  update public.payouts set status = 'manual_paid', paid_at = now(), paid_ref = ref, paid_by = auth.uid(), failed_note = null where id = u.id;
  insert into public.audit_log (actor_id, action, target_id, details)
  values (auth.uid(), 'payout_paid', u.id, jsonb_build_object('net_paise', u.net_paise, 'reference', ref, 'coach', u.coach_id));
end;
$$;

-- Admins: a transfer that bounced goes back to due, with the reason.
create function public.admin_mark_payout_failed(payout uuid, note text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  why text := left(btrim(coalesce(note, '')), 300);
  u public.payouts;
begin
  if not public.is_admin() then
    raise exception 'admins only' using errcode = '42501';
  end if;
  if why = '' then
    raise exception 'note_required' using errcode = '22023';
  end if;
  select * into u from public.payouts where id = payout for update;
  if u.id is null or u.status <> 'manual_paid' then
    raise exception 'not_paid' using errcode = '22023';
  end if;
  update public.payouts set status = 'manual_due', paid_at = null, paid_ref = null, paid_by = null, failed_note = why where id = u.id;
  insert into public.audit_log (actor_id, action, target_id, details)
  values (auth.uid(), 'payout_failed', u.id, jsonb_build_object('note', why, 'reference', u.paid_ref));
end;
$$;

-- The signed-in coach's totals: held (in the hold or with a refund open), ready to transfer, and paid.
create function public.my_earnings()
returns table (held_paise bigint, ready_paise bigint, paid_paise bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select
    coalesce(sum(u.net_paise) filter (where u.status in ('pending', 'on_hold') or (u.status = 'manual_due' and not public.payout_ready(u.id))), 0)::bigint,
    coalesce(sum(u.net_paise) filter (where public.payout_ready(u.id)), 0)::bigint,
    coalesce(sum(u.net_paise) filter (where u.status in ('manual_paid', 'processed')), 0)::bigint
  from public.payouts u
  where u.coach_id = auth.uid();
$$;

revoke all on function public.payout_ready(uuid) from public, anon, authenticated;
revoke all on function public.admin_payouts_due(), public.admin_mark_payout_paid(uuid, text), public.admin_mark_payout_failed(uuid, text),
  public.my_earnings() from public, anon;
grant execute on function public.admin_payouts_due(), public.admin_mark_payout_paid(uuid, text), public.admin_mark_payout_failed(uuid, text),
  public.my_earnings() to authenticated;

-- request_refund and admin_refund as in 20261216000000_refunds.sql, plus: no refund after the coach was paid.
create or replace function public.request_refund(engagement uuid)
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
  -- Once the coach has been paid for this payment, no refund can start (M4-13, from the Codex review): marking a
  -- payout paid takes the same payment lock, so the two cannot cross.
  if exists (select 1 from public.payouts u where u.payment_id = pay.id and u.status in ('manual_paid', 'processed')) then
    raise exception 'not_refundable' using errcode = '22023';
  end if;
  insert into public.refunds (payment_id, amount_paise, reason, requested_by) values (pay.id, pay.amount_paise, 'first_payment', auth.uid())
  returning id into r;
  insert into public.audit_log (actor_id, action, target_id, details) values (auth.uid(), 'refund_requested', g.athlete_id,
    jsonb_build_object('refund', r, 'payment', pay.id, 'engagement', g.id, 'amount_paise', pay.amount_paise, 'reason', 'first_payment'));
  return query select r, pay.provider_payment_id, pay.amount_paise;
end;
$$;

create or replace function public.admin_refund(payment uuid, why text)
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
  -- Once the coach has been paid for this payment, no refund can start (M4-13, from the Codex review): marking a
  -- payout paid takes the same payment lock, so the two cannot cross.
  if exists (select 1 from public.payouts u where u.payment_id = pay.id and u.status in ('manual_paid', 'processed')) then
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
