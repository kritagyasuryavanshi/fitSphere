'use server';

import { revalidatePath } from 'next/cache';
import { isUuid } from '@/lib/programs';
import { supabaseServer } from '@/lib/supabase/server';
import { requireRole } from '@/lib/viewer';

export type DecideState = { error?: string };

/** Mark checked, or reject with a note. The database checks the admin role again and logs the decision. */
export async function decideCredential(_prev: DecideState, formData: FormData): Promise<DecideState> {
  await requireRole('admin');
  const credential = String(formData.get('credential') ?? '');
  const approve = formData.get('decision') === 'check';
  const note = String(formData.get('note') ?? '').trim();
  if (!isUuid(credential)) return { error: 'This credential could not be found.' };
  if (!approve && !note) return { error: 'Write a note the coach will see: what is wrong and what to upload instead.' };
  const supabase = await supabaseServer();
  const { error } = await supabase.rpc('decide_credential', { credential, approve, note });
  if (error) {
    if (error.message.includes('already_decided')) return { error: 'Another admin already decided this one.' };
    if (error.message.includes('note_required')) return { error: 'Write a note the coach will see.' };
    console.error('decide_credential failed', error.code, error.message);
    return { error: 'We could not save the decision. Try again.' };
  }
  revalidatePath('/admin/credentials');
  return {};
}
