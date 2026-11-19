'use server';

import { revalidatePath } from 'next/cache';
import { after } from 'next/server';
import { sendQueuedEmails } from '@/lib/email-send';
import { siteOrigin } from '@/lib/site-origin';
import { isUuid } from '@/lib/programs';
import { supabaseServer } from '@/lib/supabase/server';
import { requireRole } from '@/lib/viewer';

export type FeedbackState = { error?: string; sent?: number };

/** The coach sends feedback to an athlete in one of their programs. The database checks the coach again. */
export async function giveFeedback(prev: FeedbackState, formData: FormData): Promise<FeedbackState> {
  await requireRole('coach');
  const enrollment = String(formData.get('enrollment') ?? '');
  const body = String(formData.get('body') ?? '').trim();
  if (!isUuid(enrollment)) return { error: 'This athlete could not be found.' };
  // Count characters as the database does (code points), so emoji are not refused early.
  if (!body || [...body].length > 2000) return { error: 'Write your feedback, up to 2,000 characters.' };
  const supabase = await supabaseServer();
  const { error } = await supabase.rpc('give_feedback', { enrollment, body });
  if (error) {
    if (error.message.includes('not_allowed')) return { error: 'This athlete is no longer in your program.' };
    if (error.message.includes('bad_feedback')) return { error: 'Write your feedback, up to 2,000 characters.' };
    console.error('give_feedback failed', error.code, error.message);
    return { error: 'We could not send your feedback. Try again.' };
  }
  revalidatePath(`/coach/athletes/${enrollment}`);
  // The note's email is queued with it; send it after the response, so the coach never waits on the provider.
  const origin = await siteOrigin();
  after(async () => {
    try {
      await sendQueuedEmails(origin);
    } catch (e) {
      console.error('sending queued emails failed', e);
    }
  });
  return { sent: (prev.sent ?? 0) + 1 };
}
