'use server';

import { createDbClient } from '@fitsphere/db';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { paymentsProvider } from '@/lib/payments/provider';
import { isUuid } from '@/lib/programs';
import { supabaseServer } from '@/lib/supabase/server';
import { requireRole } from '@/lib/viewer';

/** The athlete withdraws a request before paying. */
export async function withdrawRequest(formData: FormData): Promise<void> {
  await requireRole('athlete');
  const id = String(formData.get('engagement') ?? '');
  if (!isUuid(id)) return;
  const supabase = await supabaseServer();
  const { error } = await supabase.rpc('withdraw_request', { engagement: id });
  // not_open: it was already decided or withdrawn; the page shows the current state.
  if (error && !error.message.includes('not_open')) throw error;
  revalidatePath('/coaching');
}

const REASONS = ['too_expensive', 'not_right_fit', 'taking_break', 'injury', 'other'];

/**
 * The athlete cancels monthly coaching (X-CancelCoaching). The database records it first, so access and renewals
 * follow it whatever the provider does; then the provider stops the subscription. A charge that still arrives is
 * recorded as money owed back.
 */
export async function cancelCoaching(formData: FormData): Promise<void> {
  await requireRole('athlete');
  const id = String(formData.get('engagement') ?? '');
  if (!isUuid(id)) redirect('/coaching');
  const reason = String(formData.get('reason') ?? '');
  const supabase = await supabaseServer();
  const { error } = await supabase.rpc('cancel_coaching', REASONS.includes(reason) ? { engagement: id, reason } : { engagement: id });
  if (error) {
    if (!error.message.includes('not_cancellable')) console.error('cancel_coaching failed', error.code, error.message);
    redirect(`/coaching/${id}/cancel?error=1`);
  }
  const provider = paymentsProvider();
  if (provider && process.env.SUPABASE_SECRET_KEY) {
    const db = createDbClient(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '', process.env.SUPABASE_SECRET_KEY);
    const { data: sub } = await db.from('subscriptions').select('provider_subscription_id').eq('engagement_id', id).maybeSingle();
    if (sub) await provider.cancelSubscription(sub.provider_subscription_id).catch((e) => console.error('cancelling the subscription failed', id, e));
  }
  revalidatePath('/coaching');
  redirect('/coaching');
}
