import { Button } from '@fitsphere/ui';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { formatInr } from '@fitsphere/core';
import { Refresher } from '@/app/(account)/messages/[id]/chat-client';
import { paymentsProvider } from '@/lib/payments/provider';
import { isUuid } from '@/lib/programs';
import { supabaseServer } from '@/lib/supabase/server';
import { requireRole } from '@/lib/viewer';
import { startCheckout } from './actions';

export const metadata: Metadata = { title: 'Pay · FitSphere' };

// Pay for an accepted request. The page never activates anything: it shows what the signed webhook recorded,
// and re-reads while an order is open.
async function Pay({ params, searchParams }: PageProps<'/coaching/[id]/pay'>) {
  const viewer = await requireRole('athlete');
  const { id } = await params;
  const { unavailable } = await searchParams;
  if (!isUuid(id)) notFound();
  const supabase = await supabaseServer();
  const [eng, orders] = await Promise.all([
    supabase.from('engagements').select('package_title, package_kind, price_paise, start_date, status, paid_through').eq('id', id).eq('athlete_id', viewer.userId).maybeSingle(),
    supabase.from('orders').select('status, created_at, period_start, period_end').eq('engagement_id', id).order('created_at', { ascending: false }).limit(1),
  ]);
  if (eng.error) throw eng.error;
  if (orders.error) throw orders.error;
  const g = eng.data;
  if (!g || !['accepted', 'active', 'cancelling'].includes(g.status)) notFound();
  const provider = paymentsProvider();
  const open = orders.data[0]?.status === 'created';
  const paid = orders.data.find((o) => o.status === 'paid');

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
          <form action={startCheckout}>
            <input type="hidden" name="engagement" value={id} />
            <Button type="submit">Pay {formatInr(g.price_paise)}</Button>
          </form>
          {provider.name === 'fake' ? <p className="m-0 text-[13px] text-warning">Test mode: no real money moves.</p> : null}
          <p className="m-0 text-[13px] text-muted">Refunds: in full within 7 days of your first payment. Renewals are not refunded.</p>
        </>
      )}
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
