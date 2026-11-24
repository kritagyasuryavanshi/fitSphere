import { formatInr } from '@fitsphere/core';
import { Button, buttonClass } from '@fitsphere/ui';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { isUuid } from '@/lib/programs';
import { supabaseServer } from '@/lib/supabase/server';
import { requireRole } from '@/lib/viewer';
import { requestRefund } from '../../actions';

export const metadata: Metadata = { title: 'Ask for a refund? · FitSphere' };

async function Confirm({ params, searchParams }: PageProps<'/coaching/[id]/refund'>) {
  const viewer = await requireRole('athlete');
  const { id } = await params;
  const { error } = await searchParams;
  if (!isUuid(id)) notFound();
  const supabase = await supabaseServer();
  const { data: g, error: readError } = await supabase
    .from('engagements')
    .select('id, coach_id, package_kind')
    .eq('id', id)
    .eq('athlete_id', viewer.userId)
    .maybeSingle();
  if (readError) throw readError;
  if (!g) notFound();
  // The database applies the owner's terms; nothing is offered outside them.
  const { data: amount, error: quoteError } = await supabase.rpc('refund_quote', { engagement: id });
  if (quoteError) throw quoteError;
  if (!amount) notFound();
  const { data: name } = g.coach_id ? await supabase.rpc('coach_public_name', { coach: g.coach_id }) : { data: null };
  const coach = name || 'your coach';
  return (
    <section role="alertdialog" aria-modal="true" aria-labelledby="dlg-title" className="flex flex-col gap-5 border border-line-strong p-6">
      <h1 id="dlg-title" className="m-0 font-display text-[40px] font-normal uppercase leading-[0.95]">
        Ask for a refund?
      </h1>
      <ul className="m-0 flex flex-col gap-2 pl-5 text-[16px] leading-[1.6] text-ink-soft">
        <li>
          We refund <strong>{formatInr(amount)}</strong> in full, to the way you paid.
        </li>
        <li>
          Your coaching with {coach} ends when the refund goes through, and {coach} stops seeing your logs. Past feedback stays with you.
        </li>
        <li>
          {g.package_kind === 'monthly'
            ? 'Refunds are for a first payment, within 7 days. Renewals are not refunded.'
            : 'A session is refundable up to 24 hours before it starts.'}{' '}
          Your bank can take 5 to 7 working days to show it.
        </li>
      </ul>
      {error ? (
        <p role="alert" className="m-0 text-[15px] font-medium text-danger">
          We could not ask for your refund. Try again.
        </p>
      ) : null}
      <form action={requestRefund} className="flex flex-wrap gap-3">
        <input type="hidden" name="engagement" value={id} />
        <Button type="submit" variant="danger">
          Refund {formatInr(amount)}
        </Button>
        <Link href="/coaching" className={buttonClass({ variant: 'light' })}>
          Keep coaching
        </Link>
      </form>
    </section>
  );
}

// The refund confirm screen, built on X-CancelCoaching: asking for a refund needs this screen.
export default function RefundPage(props: PageProps<'/coaching/[id]/refund'>) {
  return (
    <main className="mx-auto flex max-w-xl flex-col px-4 py-16">
      <Suspense fallback={null}>
        <Confirm {...props} />
      </Suspense>
    </main>
  );
}
