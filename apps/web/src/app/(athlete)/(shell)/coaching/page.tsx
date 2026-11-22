import { formatInr } from '@fitsphere/core';
import { buttonClass, Tag, type TagVariant } from '@fitsphere/ui';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { shortDate } from '@/lib/dates';
import { supabaseServer } from '@/lib/supabase/server';
import { requireRole } from '@/lib/viewer';
import { openConversation } from '@/app/(account)/messages/actions';
import { withdrawRequest } from './actions';

export const metadata: Metadata = { title: 'Your coaching · FitSphere' };

const STATUS: Record<string, [string, TagVariant]> = {
  requested: ['Waiting for the coach', 'outline'],
  accepted: ['Accepted · pay to start', 'success'],
  active: ['Active', 'success'],
  cancelling: ['Cancelled · runs to the end of the paid month', 'outline'],
  ended: ['Ended', 'outline'],
  declined: ['Declined', 'outline'],
  withdrawn: ['Withdrawn', 'outline'],
  expired: ['Expired', 'outline'],
  lapsed: ['Ended · payment failed', 'outline'],
  refunded: ['Refunded', 'outline'],
};

// The athlete's hire requests and coaching, newest first. RLS also returns a coach's incoming requests (every coach
// is an athlete too), so the query keeps the ones where this person is the athlete.
async function Coaching() {
  const viewer = await requireRole('athlete');
  const supabase = await supabaseServer();
  const { data, error } = await supabase
    .from('engagements')
    .select('id, coach_id, package_title, package_kind, price_paise, start_date, status, created_at, paid_through, subscriptions(status), orders(payments(refunds(status)))')
    .eq('athlete_id', viewer.userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  if (!data.length) {
    return (
      <p className="m-0 text-[16px]">
        No coaching yet.{' '}
        <Link href="/coaches" className="underline underline-offset-4">
          Find a coach
        </Link>
        .
      </p>
    );
  }
  const names = await Promise.all(data.map((g) => (g.coach_id ? supabase.rpc('coach_public_name', { coach: g.coach_id }) : Promise.resolve({ data: null, error: null }))));
  for (const n of names) if (n.error) throw n.error;
  // What the athlete can get back now, under the owner's terms (refund_quote); only running coaching can qualify.
  const quotes = await Promise.all(
    data.map((g) => (g.status === 'active' || g.status === 'cancelling' ? supabase.rpc('refund_quote', { engagement: g.id }) : Promise.resolve({ data: null, error: null }))),
  );
  for (const q of quotes) if (q.error) throw q.error;
  // Coaching with a finished paid period that is not yet reviewed (can_review).
  const reviewable = await Promise.all(data.map((g) => (g.coach_id && g.paid_through ? supabase.rpc('can_review', { engagement: g.id }) : Promise.resolve({ data: false, error: null }))));
  for (const r of reviewable) if (r.error) throw r.error;

  return (
    <ul className="m-0 flex list-none flex-col gap-4 p-0">
      {data.map((g, i) => {
        const [label, variant] = STATUS[g.status] ?? [g.status, 'outline'];
        // One conversation per coach, so one Message button: on the newest engagement with them.
        const firstWithCoach = data.findIndex((x) => x.coach_id === g.coach_id) === i;
        const coach = names[i].data ?? 'Your coach';
        const refundable = quotes[i].data;
        const refunding = g.orders?.some((o) => o.payments?.some((p) => p.refunds?.some((r) => r.status === 'requested')));
        return (
          <li key={g.id} className="flex flex-col gap-2 border border-line p-5">
            <Tag variant={variant}>{label}</Tag>
            <p className="m-0 text-[20px] font-semibold">
              {g.coach_id && names[i].data ? (
                <Link href={`/coaches/${g.coach_id}`}>{coach}</Link>
              ) : (
                coach
              )}
            </p>
            <p className="m-0 text-[15px] text-muted">
              {g.package_title}, {formatInr(g.price_paise)}
              {g.package_kind === 'monthly' ? ' a month' : ''} · starts {g.start_date}
            </p>
            {g.status === 'active' && g.paid_through ? (
              <p className="m-0 text-[15px]">
                {g.subscriptions?.status === 'pending'
                  ? `Your last payment did not go through. We will try again; coaching is paused until it does.`
                  : g.package_kind === 'monthly' && g.subscriptions?.status === 'active'
                    ? `Renews monthly · next payment ${formatInr(g.price_paise)} on ${shortDate(g.paid_through, 1)}`
                    : `Runs until ${shortDate(g.paid_through)}`}
              </p>
            ) : null}
            {g.status === 'cancelling' && g.paid_through ? <p className="m-0 text-[15px]">Coaching until {shortDate(g.paid_through)}. No more payments are taken.</p> : null}
            {refunding && (g.status === 'active' || g.status === 'cancelling') ? (
              <p className="m-0 text-[15px]">Refund requested. Coaching ends when the refund goes through.</p>
            ) : null}
            {g.status === 'accepted' ? (
              <Link href={`/coaching/${g.id}/pay`} className={`${buttonClass()} self-start`}>
                Pay {formatInr(g.price_paise)}
              </Link>
            ) : null}
            {g.coach_id && firstWithCoach ? (
              <form action={openConversation}>
                <input type="hidden" name="engagement" value={g.id} />
                <button type="submit" className="text-[15px] font-medium underline underline-offset-4">
                  Message {coach}
                </button>
              </form>
            ) : null}
            {g.status === 'active' && g.package_kind === 'monthly' ? (
              <Link href={`/coaching/${g.id}/cancel`} className="self-start text-[15px] font-medium text-danger underline underline-offset-4">
                Cancel coaching
              </Link>
            ) : null}
            {reviewable[i].data ? (
              <Link href={`/coaching/${g.id}/review`} className="self-start text-[15px] font-medium underline underline-offset-4">
                Review {coach}
              </Link>
            ) : null}
            {refundable ? (
              <Link href={`/coaching/${g.id}/refund`} className="self-start text-[15px] font-medium underline underline-offset-4">
                Ask for a refund
              </Link>
            ) : null}
            {g.status === 'requested' || g.status === 'accepted' ? (
              <form action={withdrawRequest}>
                <input type="hidden" name="engagement" value={g.id} />
                <button type="submit" className="text-[15px] font-medium underline underline-offset-4">
                  Withdraw request
                </button>
              </form>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

export default function CoachingPage() {
  return (
    <main className="mx-auto flex w-full max-w-[880px] flex-col gap-6 px-4 pb-24 pt-8 md:px-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="m-0 font-display text-[48px] font-normal uppercase leading-[0.95]">Your coaching</h1>
        <Link href="/messages" className="text-[15px] font-medium underline underline-offset-4">
          Messages
        </Link>
      </div>
      <Suspense fallback={null}>
        <Coaching />
      </Suspense>
    </main>
  );
}
