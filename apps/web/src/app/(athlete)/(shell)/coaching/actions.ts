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
