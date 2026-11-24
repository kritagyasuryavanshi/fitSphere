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
  if (!isUuid(engagement)) redirect('/coaching');
  const provider = paymentsProvider();
  // Checkout closed or not set up: say so on the page rather than doing nothing.
  if (!provider || !process.env.SUPABASE_SECRET_KEY) redirect(`/coaching/${engagement}/pay?unavailable=1`);
  // The athlete's own accepted engagement, read as them (RLS), before the server acts for them.
  const supabase = await supabaseServer();
  const { data: mine, error: readError } = await supabase.from('engagements').select('id').eq('id', engagement).eq('athlete_id', viewer.userId).eq('status', 'accepted').maybeSingle();
  if (readError) throw readError;
  if (!mine) redirect(`/coaching/${engagement}/pay`);

  const db = createDbClient(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '', process.env.SUPABASE_SECRET_KEY);
  const { data, error } = await db.rpc('start_checkout', { engagement, athlete: viewer.userId }).single();
  // A single session needs a held time first (M4-17); the hold may have run out.
  if (error?.message.includes('needs_slot')) redirect(`/coaching/${engagement}/pay?slot=expired`);
  if (error) throw error;
  if (!data.provider_order_id) {
    const created = await provider.createOrder({ amountPaise: data.amount_paise, receipt: data.order_id });
    // A double click attaches once; both clicks go on with the order attached first.
    const attached = await db.rpc('attach_provider_order', { order_: data.order_id, provider_order: created.id });
    if (attached.error) throw attached.error;
  }
  // shortcut: the fake provider pays at once, through the signed webhook; Razorpay Checkout opens here in M4-09b.
  if (provider.name === 'fake') {
    await captureFakeOrder(data.order_id);
    // shortcut: the fake opens the monthly subscription after the first payment; Razorpay Subscriptions (M4-11b)
    // take the first charge themselves.
    // The athlete has paid by now: a subscription problem is logged, never shown as a failed payment.
    // shortcut: a monthly engagement left without a subscription ends at its paid date; M4-11b opens it at checkout.
    let created: string | null = null;
    try {
      const { data: paid, error: paidError } = await db.from('engagements').select('package_kind, status, price_paise, subscriptions(id)').eq('id', engagement).single();
      if (paidError) throw paidError;
      if (paid.package_kind === 'monthly' && paid.status === 'active' && !paid.subscriptions) {
        const sub = await provider.createSubscription({ engagement, amountPaise: paid.price_paise });
        created = sub.id;
        const attached = await db.rpc('attach_subscription', { engagement, provider_subscription: sub.id });
        if (attached.error) throw attached.error;
        // Two clicks at once: the first attach wins, and the extra subscription is cancelled at once.
        if (attached.data === sub.id) created = null;
      }
    } catch (e) {
      console.error('opening the subscription failed', engagement, e);
    }
    // Two clicks at once (the first attach wins), or an attach that failed: the extra subscription never charges.
    if (created) await provider.cancelSubscription(created).catch((e) => console.error('cancelling an unattached subscription failed', created, e));
  }
  redirect(`/coaching/${engagement}/pay`);
}

/**
 * Pays the next month of active monthly coaching that renews by orders (Decision 1). The database decides the period,
 * the amount and whether it is due; only the signed webhook adds the month.
 */
export async function startRenewalCheckout(formData: FormData): Promise<void> {
  const viewer = await requireRole('athlete');
  const engagement = String(formData.get('engagement') ?? '');
  if (!isUuid(engagement)) redirect('/coaching');
  const provider = paymentsProvider();
  if (!provider || !process.env.SUPABASE_SECRET_KEY) redirect(`/coaching/${engagement}/pay?unavailable=1`);
  const db = createDbClient(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '', process.env.SUPABASE_SECRET_KEY);
  const { data, error } = await db.rpc('start_renewal_checkout', { engagement, athlete: viewer.userId }).single();
  // Not due yet, renewing by subscription, cancelled or run out: the page says where things stand.
  if (error?.message === 'not_due' || error?.message === 'not_payable') redirect(`/coaching/${engagement}/pay`);
  if (error) throw error;
  if (!data.provider_order_id) {
    const created = await provider.createOrder({ amountPaise: data.amount_paise, receipt: data.order_id });
    const attached = await db.rpc('attach_provider_order', { order_: data.order_id, provider_order: created.id });
    if (attached.error) throw attached.error;
  }
  // shortcut: the fake provider pays at once, through the signed webhook; Razorpay Checkout opens here in M4-09b.
  if (provider.name === 'fake') await captureFakeOrder(data.order_id);
  redirect(`/coaching/${engagement}/pay?renewed=1`);
}

/** M4-17: holds a session time for 15 minutes. The database checks the window, the 48 hours and overlaps. */
export async function holdSlot(formData: FormData): Promise<void> {
  await requireRole('athlete');
  const engagement = String(formData.get('engagement') ?? '');
  const starts = String(formData.get('starts') ?? '');
  if (!isUuid(engagement) || Number.isNaN(Date.parse(starts))) redirect('/coaching');
  const { error } = await (await supabaseServer()).rpc('reserve_slot', { engagement, starts });
  const code = error ? (['slot_taken', 'too_soon', 'not_available'].find((c) => error.message.includes(c)) ?? 'failed') : null;
  if (error && code === 'failed') console.error('reserve_slot failed', error.message);
  redirect(`/coaching/${engagement}/pay${code ? `?slot=${code}` : ''}`);
}
