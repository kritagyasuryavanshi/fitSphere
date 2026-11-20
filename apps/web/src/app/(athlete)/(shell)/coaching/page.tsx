import { formatInr } from '@fitsphere/core';
import { buttonClass, Tag, type TagVariant } from '@fitsphere/ui';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { supabaseServer } from '@/lib/supabase/server';
import { requireRole } from '@/lib/viewer';
import { openConversation } from '@/app/(account)/messages/actions';
import { withdrawRequest } from './actions';

export const metadata: Metadata = { title: 'Your coaching · FitSphere' };

const STATUS: Record<string, [string, TagVariant]> = {
  requested: ['Waiting for the coach', 'outline'],
  accepted: ['Accepted · pay to start', 'success'],
  active: ['Active', 'success'],
  cancelling: ['Ends at the end of this period', 'outline'],
  ended: ['Ended', 'outline'],
  declined: ['Declined', 'outline'],
  withdrawn: ['Withdrawn', 'outline'],
  expired: ['Expired', 'outline'],
  lapsed: ['Lapsed', 'outline'],
  refunded: ['Refunded', 'outline'],
};

// The athlete's hire requests and coaching, newest first. RLS also returns a coach's incoming requests (every coach
// is an athlete too), so the query keeps the ones where this person is the athlete.
async function Coaching() {
  const viewer = await requireRole('athlete');
  const supabase = await supabaseServer();
  const { data, error } = await supabase
    .from('engagements')
    .select('id, coach_id, package_title, package_kind, price_paise, start_date, status, created_at')
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

  return (
    <ul className="m-0 flex list-none flex-col gap-4 p-0">
      {data.map((g, i) => {
        const [label, variant] = STATUS[g.status] ?? [g.status, 'outline'];
        const coach = names[i].data ?? 'Your coach';
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
            {g.status === 'accepted' ? (
              <Link href={`/coaching/${g.id}/pay`} className={`${buttonClass()} self-start`}>
                Pay {formatInr(g.price_paise)}
              </Link>
            ) : null}
            {g.coach_id ? (
              <form action={openConversation}>
                <input type="hidden" name="engagement" value={g.id} />
                <button type="submit" className="text-[15px] font-medium underline underline-offset-4">
                  Message {coach}
                </button>
              </form>
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
