import { Button } from '@fitsphere/ui';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { formatInr, indiaToday } from '@fitsphere/core';
import { Refresher } from '@/app/(account)/messages/[id]/chat-client';
import { paymentsProvider } from '@/lib/payments/provider';
import { isUuid } from '@/lib/programs';
import { supabaseServer } from '@/lib/supabase/server';
import { renewalState } from '@/lib/renewal';
import { requireRole } from '@/lib/viewer';
import { holdSlot, startCheckout, startRenewalCheckout } from './actions';

export const metadata: Metadata = { title: 'Pay · FitSphere' };

const sessionTime = new Intl.DateTimeFormat('en-IN', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' });
const clock = new Intl.DateTimeFormat('en-IN', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' });
const SLOT_ERRORS: Record<string, string> = {
  slot_taken: 'Someone just took that time. Pick another.',
  too_soon: 'Sessions are booked at least 48 hours ahead. Pick a later time.',
  not_available: 'That time is outside your coach’s hours. Pick another.',
  expired: 'Your hold ran out. Pick the time again, then pay.',
  failed: 'That did not work. Try again.',
};

// Pay for an accepted request. The page never activates anything: it shows what the signed webhook recorded,
// and re-reads while an order is open.
async function Pay({ params, searchParams }: PageProps<'/coaching/[id]/pay'>) {
  const viewer = await requireRole('athlete');
  const { id } = await params;
  const { unavailable, renewed, slot } = await searchParams;
  if (!isUuid(id)) notFound();
  const supabase = await supabaseServer();
  const [eng, orders, subs] = await Promise.all([
    supabase.from('engagements').select('package_title, package_kind, price_paise, start_date, status, paid_through').eq('id', id).eq('athlete_id', viewer.userId).maybeSingle(),
    supabase.from('orders').select('status, created_at, period_start, period_end').eq('engagement_id', id).order('created_at', { ascending: false }).limit(1),
    supabase.from('subscriptions').select('status').eq('engagement_id', id).in('status', ['active', 'pending']),
  ]);
  if (subs.error) throw subs.error;
  // M4-17: a single session is booked for a time first. The live hold, and the free times to choose from.
  const single = eng.data?.package_kind === 'single' && eng.data.status === 'accepted';
  const [held, freeTimes] = single
    ? await Promise.all([
        supabase.from('bookings').select('starts_at, hold_expires_at').eq('engagement_id', id).eq('status', 'held').gt('hold_expires_at', new Date().toISOString()).maybeSingle(),
        supabase.rpc('open_slots', { engagement: id, days: 14 }),
      ])
    : [null, null];
  if (held?.error) throw held.error;
  if (freeTimes?.error) throw freeTimes.error;
  if (eng.error) throw eng.error;
  if (orders.error) throw orders.error;
  const g = eng.data;
  if (!g || !['accepted', 'active', 'cancelling'].includes(g.status)) notFound();
  const provider = paymentsProvider();
  const open = orders.data[0]?.status === 'created';
  const paid = orders.data.find((o) => o.status === 'paid');
  // Decision 1: active monthly coaching without a subscription renews when the athlete pays the next month.
  const renewal = g.status === 'active' && g.package_kind === 'monthly' && g.paid_through ? renewalState(g.paid_through, indiaToday(), subs.data.length > 0) : null;

  return (
    <>
      <h1 className="m-0 font-display text-[48px] font-normal uppercase leading-[0.95]">{g.status === 'accepted' ? 'Pay' : 'Paid'}</h1>
      <p className="m-0 text-[18px]">
        {g.package_title}: {formatInr(g.price_paise)}
        {g.package_kind === 'monthly' ? ' for the first month' : ''}
      </p>
      {g.status !== 'accepted' ? (
        <p role="status" className="m-0 text-[16px] font-medium text-success">
          Payment received. {paid ? `Coaching runs ${paid.period_start} to ${paid.period_end}.` : `Paid through ${g.paid_through}.`}
        </p>
      ) : !provider || unavailable ? (
        <p className="m-0 text-[16px] text-ink-soft">Checkout is not open yet. Your coach keeps your place while you wait. We will tell you when you can pay.</p>
      ) : (
        <>
          {open ? (
            <>
              <Refresher />
              <p role="status" className="m-0 text-[15px] text-muted">
                Confirming any payment you made. This page updates by itself.
              </p>
            </>
          ) : null}
          {single ? (
            <section aria-labelledby="time" className="flex flex-col gap-3">
              <h2 id="time" className="m-0 text-[20px] font-semibold">
                Your session time
              </h2>
              {typeof slot === 'string' && SLOT_ERRORS[slot] ? (
                <p role="alert" className="m-0 text-[15px] font-medium text-danger">
                  {SLOT_ERRORS[slot]}
                </p>
              ) : null}
              {held?.data ? (
                <p role="status" className="m-0 text-[16px]">
                  Held for you: <strong>{sessionTime.format(new Date(held.data.starts_at))}</strong> (India time), until {clock.format(new Date(held.data.hold_expires_at!))}. Pay to book it.
                </p>
              ) : null}
              {freeTimes?.data.length ? (
                <form action={holdSlot} className="flex flex-wrap items-end gap-2">
                  <input type="hidden" name="engagement" value={id} />
                  <div className="flex flex-col gap-1">
                    <label htmlFor="slot-pick" className="text-[15px] font-medium">
                      {held?.data ? 'Pick another time' : 'Pick a time'}
                    </label>
                    <select id="slot-pick" name="starts" required className="min-h-12 border border-line-strong bg-paper px-3 text-[16px]">
                      {freeTimes.data.map((o) => (
                        <option key={o.starts_at} value={o.starts_at}>
                          {sessionTime.format(new Date(o.starts_at))}
                        </option>
                      ))}
                    </select>
                  </div>
                  <Button type="submit" variant={held?.data ? 'light' : 'ink'}>
                    Hold this time
                  </Button>
                </form>
              ) : (
                <p className="m-0 text-[15px] text-ink-soft">No free times in the next two weeks. Message your coach to find one.</p>
              )}
            </section>
          ) : null}
          {!single || held?.data ? (
            <form action={startCheckout}>
              <input type="hidden" name="engagement" value={id} />
              <Button type="submit">Pay {formatInr(g.price_paise)}</Button>
            </form>
          ) : null}
          {provider.name === 'fake' ? <p className="m-0 text-[13px] text-warning">Test mode: no real money moves.</p> : null}
          <p className="m-0 text-[13px] text-muted">
            {g.package_kind === 'single' ? 'Refunds: in full up to 24 hours before the session.' : 'Refunds: in full within 7 days of your first payment. Renewals are not refunded.'}
          </p>
        </>
      )}
      {renewed === '1' ? (
        <p role="status" className="m-0 text-[15px] text-muted">
          Confirming your payment for the next month. Your paid date moves once it arrives.
        </p>
      ) : null}
      {renewal === 'due' || renewal === 'grace' ? (
        <section aria-labelledby="next-month" className="flex flex-col gap-3 border border-line-strong p-5">
          <h2 id="next-month" className="m-0 text-[20px] font-semibold">
            Your next month
          </h2>
          <p className="m-0 text-[16px] text-ink-soft">
            {renewal === 'due'
              ? `Your coaching runs until ${g.paid_through}. Pay for the next month to keep going.`
              : `Your paid month ended on ${g.paid_through}. Pay within 3 days of that date, or your coaching ends.`}
          </p>
          {provider ? (
            <form action={startRenewalCheckout}>
              <input type="hidden" name="engagement" value={id} />
              <Button type="submit">Pay {formatInr(g.price_paise)} for the next month</Button>
            </form>
          ) : (
            <p className="m-0 text-[15px] text-ink-soft">Checkout is not open yet.</p>
          )}
          <p className="m-0 text-[13px] text-muted">Renewals are not refunded. Not paying simply ends the coaching after the 3 days.</p>
        </section>
      ) : null}
      <Link href="/coaching" className="text-[15px] font-medium underline underline-offset-4">
        Back to your coaching
      </Link>
    </>
  );
}

export default function PayPage(props: PageProps<'/coaching/[id]/pay'>) {
  return (
    <main className="mx-auto flex w-full max-w-[720px] flex-col gap-4 px-4 pb-24 pt-8 md:px-10">
      <Suspense fallback={null}>
        <Pay {...props} />
      </Suspense>
    </main>
  );
}
