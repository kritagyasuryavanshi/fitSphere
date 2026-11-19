import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { formatInr } from '@fitsphere/core';
import { isUuid } from '@/lib/programs';
import { supabaseServer } from '@/lib/supabase/server';
import { requireRole } from '@/lib/viewer';

export const metadata: Metadata = { title: 'Pay · FitSphere' };

// shortcut: checkout arrives with M4-09 (the payment core with a test-mode provider); until then this page says so.
async function Pay({ params }: PageProps<'/coaching/[id]/pay'>) {
  await requireRole('athlete');
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const supabase = await supabaseServer();
  const { data, error } = await supabase.from('engagements').select('package_title, price_paise, status').eq('id', id).maybeSingle();
  if (error) throw error;
  if (!data || data.status !== 'accepted') notFound();
  return (
    <>
      <h1 className="m-0 font-display text-[48px] font-normal uppercase leading-[0.95]">Pay</h1>
      <p className="m-0 text-[18px]">
        {data.package_title}: {formatInr(data.price_paise)}
      </p>
      <p className="m-0 text-[16px] text-ink-soft">Checkout is not open yet. Your coach keeps your place while you wait. We will tell you when you can pay.</p>
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
