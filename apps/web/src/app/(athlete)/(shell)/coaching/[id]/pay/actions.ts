'use server';

import { createDbClient } from '@fitsphere/db';
import { redirect } from 'next/navigation';
import { captureFakeOrder } from '@/lib/payments/fake-checkout';
import { paymentsProvider } from '@/lib/payments/provider';
import { isUuid } from '@/lib/programs';
import { supabaseServer } from '@/lib/supabase/server';
import { requireRole } from '@/lib/viewer';

/**
 * Starts checkout for the athlete's accepted engagement. The amount comes from the engagement in the database, never
 * from the browser. Paying itself happens at the provider; only its signed webhook marks the order paid.
 */
export async function startCheckout(formData: FormData): Promise<void> {
  const viewer = await requireRole('athlete');
  const engagement = String(formData.get('engagement') ?? '');
  if (!isUuid(engagement)) return;
  const provider = paymentsProvider();
  if (!provider || !process.env.SUPABASE_SECRET_KEY) return;
  // The athlete's own accepted engagement, read as them (RLS), before the server acts for them.
  const supabase = await supabaseServer();
  const { data: mine, error: readError } = await supabase.from('engagements').select('id').eq('id', engagement).eq('athlete_id', viewer.userId).eq('status', 'accepted').maybeSingle();
  if (readError) throw readError;
  if (!mine) redirect(`/coaching/${engagement}/pay`);

  const db = createDbClient(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '', process.env.SUPABASE_SECRET_KEY);
  const { data, error } = await db.rpc('start_checkout', { engagement, athlete: viewer.userId }).single();
  if (error) throw error;
  let providerOrder = data.provider_order_id;
  if (!providerOrder) {
    providerOrder = (await provider.createOrder({ amountPaise: data.amount_paise, receipt: data.order_id })).id;
    const attached = await db.rpc('attach_provider_order', { order_: data.order_id, provider_order: providerOrder });
    if (attached.error) throw attached.error;
  }
  // shortcut: the fake provider pays at once, through the signed webhook; Razorpay Checkout opens here in M4-09b.
  if (provider.name === 'fake') await captureFakeOrder(data.order_id);
  redirect(`/coaching/${engagement}/pay`);
}
