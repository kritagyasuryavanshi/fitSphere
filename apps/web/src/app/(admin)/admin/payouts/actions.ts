'use server';

import { redirect } from 'next/navigation';
import { isUuid } from '@/lib/programs';
import { supabaseServer } from '@/lib/supabase/server';
import { requireRole } from '@/lib/viewer';

// The error codes the page explains; anything else is logged and shown as a failed save.
const KNOWN = ['reference_required', 'on_hold', 'refund_open', 'not_due', 'note_required', 'not_paid'];

function back(error: { message: string } | null, ok: string): never {
  const known = error ? KNOWN.find((k) => error.message.includes(k)) : undefined;
  if (error && !known) console.error('payout action failed', error.message);
  redirect(`/admin/payouts?${error ? `error=${known ?? 'failed'}` : `done=${ok}`}`);
}

/** M4-13: records a bank transfer. The database re-checks the hold and refunds under the payment lock. */
export async function markPayoutPaid(formData: FormData): Promise<void> {
  await requireRole('admin');
  const payout = String(formData.get('payout') ?? '');
  if (!isUuid(payout)) redirect('/admin/payouts');
  const { error } = await (await supabaseServer()).rpc('admin_mark_payout_paid', { payout, reference: String(formData.get('reference') ?? '').slice(0, 100) });
  back(error, 'paid');
}

/** M4-13: a transfer that bounced goes back to due. */
export async function markPayoutFailed(formData: FormData): Promise<void> {
  await requireRole('admin');
  const payout = String(formData.get('payout') ?? '');
  if (!isUuid(payout)) redirect('/admin/payouts');
  const { error } = await (await supabaseServer()).rpc('admin_mark_payout_failed', { payout, note: String(formData.get('note') ?? '').slice(0, 300) });
  back(error, 'failed');
}
