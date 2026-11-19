'use server';

import { revalidatePath } from 'next/cache';
import { isUuid } from '@/lib/programs';
import { supabaseServer } from '@/lib/supabase/server';
import { requireRole } from '@/lib/viewer';

export type DecideState = { error?: string };

const messages: Record<string, string> = {
  coach_full: 'You are at your client limit. Raise it in your profile, or decline.',
  not_open: 'This request was already withdrawn or decided.',
};

/** The coach accepts or declines a hire request. */
export async function decideRequest(_prev: DecideState, formData: FormData): Promise<DecideState> {
  await requireRole('coach');
  const id = String(formData.get('engagement') ?? '');
  if (!isUuid(id)) return { error: 'We could not find that request.' };
  const supabase = await supabaseServer();
  const { error } = await supabase.rpc('decide_request', { engagement: id, accept: formData.get('accept') === 'true' });
  if (error) {
    const known = Object.keys(messages).find((k) => error.message.includes(k));
    if (!known) console.error('decide_request failed', error.code, error.message);
    return { error: known ? messages[known] : 'We could not save this. Try again.' };
  }
  revalidatePath('/coach/clients');
  return {};
}
