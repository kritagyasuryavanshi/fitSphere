'use server';

import { revalidatePath } from 'next/cache';
import { isUuid } from '@/lib/programs';
import { supabaseServer } from '@/lib/supabase/server';
import { requireSignedIn } from '@/lib/viewer';

export type ReplyState = { error?: string; sent?: number };

/** The athlete answers feedback from their coach. The database checks the feedback is theirs. */
export async function replyFeedback(prev: ReplyState, formData: FormData): Promise<ReplyState> {
  await requireSignedIn();
  const feedback = String(formData.get('feedback') ?? '');
  const body = String(formData.get('body') ?? '').trim();
  if (!isUuid(feedback)) return { error: 'This feedback could not be found.' };
  // Count characters as the database does (code points), so emoji are not refused early.
  if (!body || [...body].length > 1000) return { error: 'Write your reply, up to 1,000 characters.' };
  const supabase = await supabaseServer();
  const { error } = await supabase.rpc('reply_feedback', { feedback, body });
  if (error) {
    if (error.message.includes('not_in_program')) return { error: 'You are no longer in this program, so your coach would not see a reply.' };
    if (error.message.includes('not_allowed')) return { error: 'This feedback could not be found.' };
    if (error.message.includes('bad_reply')) return { error: 'Write your reply, up to 1,000 characters.' };
    console.error('reply_feedback failed', error.code, error.message);
    return { error: 'We could not send your reply. Try again.' };
  }
  revalidatePath('/account/feedback');
  return { sent: (prev.sent ?? 0) + 1 };
}
