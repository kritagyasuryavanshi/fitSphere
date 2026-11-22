'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { isUuid } from '@/lib/programs';
import { supabaseServer } from '@/lib/supabase/server';
import { requireRole } from '@/lib/viewer';

/** The coach replies to a review of their coaching, once (M4-14). The database checks the coach and the one reply. */
export async function replyReview(formData: FormData): Promise<void> {
  await requireRole('coach');
  const id = String(formData.get('review') ?? '');
  const reply = String(formData.get('reply') ?? '').trim();
  if (!isUuid(id)) redirect('/coach/reviews');
  if (!reply || reply.length > 1000) redirect('/coach/reviews?error=reply');
  const { error } = await (await supabaseServer()).rpc('reply_review', { review: id, reply });
  // Already replied (a double click, an old tab): the page shows the reply.
  if (error && !error.message.includes('already_replied')) {
    console.error('reply_review failed', error.code, error.message);
    redirect('/coach/reviews?error=failed');
  }
  revalidatePath('/coach/reviews');
  redirect('/coach/reviews');
}
