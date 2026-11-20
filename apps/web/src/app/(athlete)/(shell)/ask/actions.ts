'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import type { Answer } from '@/lib/ai/answer';
import { aiModel } from '@/lib/ai/model';
import { askGuide } from '@/lib/ai/service';
import { isUuid } from '@/lib/programs';
import { supabaseServer } from '@/lib/supabase/server';
import { requireRole } from '@/lib/viewer';

// draft: what was typed, kept when the question was not taken; answer: a reply with no saved question (the limit).
export type AskState = { error?: string; draft?: string; answer?: Answer };

export async function ask(_prev: AskState, formData: FormData): Promise<AskState> {
  const viewer = await requireRole('athlete');
  const question = String(formData.get('question') ?? '').trim();
  if (!question) return { error: 'Type a question first.' };
  if (question.length > 500) return { error: 'Keep your question to 500 characters.', draft: question };
  const model = aiModel();
  if (!model) return { error: 'The AI guide is not switched on yet.', draft: question };
  let result: Awaited<ReturnType<typeof askGuide>>;
  try {
    result = await askGuide(viewer, question, model);
  } catch (e) {
    console.error('askGuide failed', e instanceof Error ? e.message : e);
    return { error: 'I could not answer that just now. Try again in a moment.', draft: question };
  }
  const { id, answer } = result;
  // No saved answer to show from the history (the limit, a failure): show it here, keeping what was typed.
  if (!id) return { answer, draft: question };
  revalidatePath('/ask');
  redirect(`/ask?q=${id}`);
}

/** Puts the cited lessons on the athlete's day. Only published items are added (add_to_today checks). */
export async function addToToday(formData: FormData): Promise<void> {
  await requireRole('athlete');
  const items = formData.getAll('item').map(String).filter(isUuid).slice(0, 10);
  const back = String(formData.get('question') ?? '');
  let added = 0;
  if (items.length) {
    const supabase = await supabaseServer();
    const { data, error } = await supabase.rpc('add_to_today', { items });
    if (error) throw error;
    added = data ?? 0;
    revalidatePath('/today');
  }
  // added: how many went on today, so the page says what really happened.
  redirect(isUuid(back) ? `/ask?q=${back}&added=${added}` : '/ask');
}
