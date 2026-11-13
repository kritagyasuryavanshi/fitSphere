'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { supabaseServer } from '@/lib/supabase/server';
import { requireRole } from '@/lib/viewer';
import { reviewChecks } from './checks';

export type ReviewState = { error?: string; field?: 'note' | 'checks' };

const messages: Record<string, string> = {
  own_item: 'You wrote this. Another reviewer approves it.',
  not_in_review: 'This lesson is no longer waiting for review.',
  note_required: 'Write a note so the coach knows what to change.',
};

/** Approve and publish, or send back with a note. review_content enforces the rules; this only shapes the request. */
export async function reviewItem(_prev: ReviewState, formData: FormData): Promise<ReviewState> {
  await requireRole('reviewer');
  const item = String(formData.get('item') ?? '');
  if (!/^[0-9a-f-]{36}$/.test(item)) return { error: 'This lesson was not found.' };
  const approve = formData.get('decision') === 'approve';
  const note = String(formData.get('note') ?? '').trim();
  if (approve && formData.getAll('check').length !== reviewChecks.length) return { error: 'Tick every check to publish.', field: 'checks' };
  if (!approve && !note) return { error: messages.note_required, field: 'note' };

  const { error } = await (await supabaseServer()).rpc('review_content', { item, approve, note });
  if (error) {
    const key = Object.keys(messages).find((k) => error.message.includes(k));
    return { error: key ? messages[key] : 'We could not save this decision. Try again.', field: key === 'note_required' ? 'note' : undefined };
  }
  revalidatePath('/review');
  revalidatePath('/coach/lessons');
  redirect(`/review?done=${approve ? 'published' : 'sent-back'}`);
}
