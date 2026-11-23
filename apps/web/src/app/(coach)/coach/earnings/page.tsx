import { formatInr } from '@fitsphere/core';
import type { Metadata } from 'next';
import { Suspense } from 'react';
import { supabaseServer } from '@/lib/supabase/server';
import { requireRole } from '@/lib/viewer';

export const metadata: Metadata = { title: 'Earnings · FitSphere Coach' };

// M4-13: what the coach has earned, after FitSphere's fee. Estimates until a CA confirms the fee and tax (Decision 4).
async function Earnings() {
  await requireRole('coach');
  const { data, error } = await (await supabaseServer()).rpc('my_earnings').single();
  if (error) throw error;
  const rows: [string, number, string][] = [
    ['Held', data.held_paise, 'In the 7-day hold, or with a refund asked'],
    ['Ready to pay', data.ready_paise, 'We transfer this to your bank account'],
    ['Paid', data.paid_paise, 'Already in your bank account'],
  ];
  return (
    <>
      <dl className="m-0 grid gap-4 md:grid-cols-3">
        {rows.map(([label, paise, hint]) => (
          <div key={label} className="flex flex-col gap-1 border border-line-strong p-5">
            <dt className="text-[14px] font-medium text-muted">{label}</dt>
            <dd className="m-0 text-[28px] font-semibold tabular-nums">{formatInr(paise)}</dd>
            <dd className="m-0 text-[14px] text-ink-soft">{hint}</dd>
          </div>
        ))}
      </dl>
      <p className="m-0 text-[14px] text-muted">
        Estimated. Amounts are after FitSphere’s 15% fee, which FitSphere confirms with its accountant before payouts start.
      </p>
    </>
  );
}

export default function EarningsPage() {
  return (
    <main className="mx-auto flex max-w-[1080px] flex-col gap-6 px-4 py-10 md:px-10">
      <h1 className="m-0 font-display text-[48px] font-normal uppercase leading-[0.95] md:text-[64px]">Earnings</h1>
      <Suspense fallback={null}>
        <Earnings />
      </Suspense>
    </main>
  );
}
