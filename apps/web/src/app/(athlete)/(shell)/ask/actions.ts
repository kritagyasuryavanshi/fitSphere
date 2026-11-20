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
  const { id, answer } = await askGuide(viewer, question, model);
  if (!id) return { answer, draft: question };
  revalidatePath('/ask');
  redirect(`/ask?q=${id}`);
}

/** Puts the cited lessons on the athlete's day. Only published items are added (add_to_today checks). */
export async function addToToday(formData: FormData): Promise<void> {
  await requireRole('athlete');
  const items = formData.getAll('item').map(String).filter(isUuid).slice(0, 10);
  const back = String(formData.get('question') ?? '');
  if (items.length) {
    const supabase = await supabaseServer();
    const { error } = await supabase.rpc('add_to_today', { items });
    if (error) throw error;
    revalidatePath('/today');
  }
  redirect(isUuid(back) ? `/ask?q=${back}&added=1` : '/ask');
}
