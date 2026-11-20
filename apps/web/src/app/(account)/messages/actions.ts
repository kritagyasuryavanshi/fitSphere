'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { isUuid } from '@/lib/programs';
import { supabaseServer } from '@/lib/supabase/server';
import { requireSignedIn } from '@/lib/viewer';

// sent: a new value after each send, so the form clears; draft: what was typed, kept after a refusal.
export type SendState = { error?: string; draft?: string; sent?: number };

/** Opens (or makes) the conversation for an engagement, then goes there. */
export async function openConversation(formData: FormData): Promise<void> {
  await requireSignedIn();
  const engagement = String(formData.get('engagement') ?? '');
  if (!isUuid(engagement)) return;
  const supabase = await supabaseServer();
  const { data, error } = await supabase.rpc('open_conversation', { engagement });
  if (error) throw error;
  redirect(`/messages/${data}`);
}

const messages: Record<string, string> = {
  bad_message: 'Write a message of up to 2,000 characters.',
  closed: 'This person has left FitSphere, so they cannot get messages.',
};

export async function sendMessage(_prev: SendState, formData: FormData): Promise<SendState> {
  await requireSignedIn();
  const conversation = String(formData.get('conversation') ?? '');
  const body = String(formData.get('body') ?? '');
  if (!isUuid(conversation)) return { error: 'We could not find this conversation.' };
  const supabase = await supabaseServer();
  const { error } = await supabase.rpc('send_message', { conversation, body });
  if (error) {
    const known = Object.keys(messages).find((k) => error.message.includes(k));
    if (!known) console.error('send_message failed', error.code, error.message);
    return { error: known ? messages[known] : 'We could not send this. Try again.', draft: body };
  }
  revalidatePath(`/messages/${conversation}`);
  return { sent: Date.now() };
}
