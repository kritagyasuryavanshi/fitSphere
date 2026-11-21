'use server';

import { createDbClient } from '@fitsphere/db';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { paymentsProvider } from '@/lib/payments/provider';
import { stopSubscriptions } from '@/lib/payments/reconcile';
import { sendRefundsNow } from '@/lib/payments/refunds';
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
    // Already cancelled (a double click, an old tab): the list shows how it stands.
    if (error.message.includes('not_cancellable')) redirect('/coaching');
    console.error('cancel_coaching failed', error.code, error.message);
    redirect(`/coaching/${id}/cancel?error=1`);
  }
  // The provider stops renewing now; if that fails, the daily cron retries it (stopSubscriptions).
  const provider = paymentsProvider();
  if (provider && process.env.SUPABASE_SECRET_KEY) {
    const db = createDbClient(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '', process.env.SUPABASE_SECRET_KEY);
    try {
      const { data: sub, error: subError } = await db.from('subscriptions').select('id, provider_subscription_id').eq('engagement_id', id).maybeSingle();
      if (subError) throw subError;
      if (sub) {
        await provider.cancelSubscription(sub.provider_subscription_id);
        const marked = await db.rpc('mark_subscription_cancelled', { subscription: sub.id });
        if (marked.error) throw marked.error;
      }
    } catch (e) {
      console.error('cancelling the subscription failed, the cron retries it', id, e);
    }
  }
  revalidatePath('/coaching');
  redirect('/coaching');
}

/**
 * The athlete asks for a refund of their first payment (M4-12). The database checks the owner's terms and records it;
 * then the provider is sent the refund. If that fails, the daily cron sends it again. The coaching ends when the
 * provider confirms the refund, and its subscription stops then.
 */
export async function requestRefund(formData: FormData): Promise<void> {
  await requireRole('athlete');
  const id = String(formData.get('engagement') ?? '');
  if (!isUuid(id)) redirect('/coaching');
  const supabase = await supabaseServer();
  const { data, error } = await supabase.rpc('request_refund', { engagement: id });
  if (error) {
    // Already asked for, or out of the terms now (a double click, an old tab): the list shows how it stands.
    if (error.message.includes('not_refundable')) redirect('/coaching');
    console.error('request_refund failed', error.code, error.message);
    redirect(`/coaching/${id}/refund?error=1`);
  }
  await sendRefundsNow(data).catch((e) => console.error('sending the refund failed, the cron retries it', id, e));
  await stopSubscriptions().catch((e) => console.error('stopping subscriptions after a refund failed', e));
  revalidatePath('/coaching');
  redirect('/coaching');
}
