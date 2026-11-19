'use server';

import { revalidatePath } from 'next/cache';
import { isUuid } from '@/lib/programs';
import { supabaseServer } from '@/lib/supabase/server';
import { requireRole } from '@/lib/viewer';

export type ShortlistState = { error?: string };

const messages: Record<string, string> = {
  shortlist_full: 'Your shortlist holds 20 coaches. Remove one first.',
  not_live: 'This coach is not taking clients on FitSphere right now.',
  own_profile: 'This is your own profile.',
};

/** Adds or removes a coach on the signed-in person's shortlist. Only they see it; the coach is not told. */
export async function toggleShortlist(_prev: ShortlistState, formData: FormData): Promise<ShortlistState> {
  await requireRole('athlete');
  const coach = String(formData.get('coach') ?? '');
  if (!isUuid(coach)) return { error: 'We could not find that coach.' };
  const supabase = await supabaseServer();
  const { error } = await supabase.rpc('shortlist_coach', { coach, on_list: formData.get('on') === 'true' });
  if (error) {
    const known = Object.keys(messages).find((k) => error.message.includes(k));
    if (!known) console.error('shortlist_coach failed', error.code, error.message);
    return { error: known ? messages[known] : 'We could not save this. Try again.' };
  }
  revalidatePath('/coaches', 'layout');
  revalidatePath('/shortlist');
  return {};
}
