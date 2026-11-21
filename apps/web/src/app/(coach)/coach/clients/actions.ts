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
  const { error } = await supabase.rpc('decide_request', {
    engagement: id,
    accept: formData.get('accept') === 'true',
  });
  if (error) {
    const known = Object.keys(messages).find((k) => error.message.includes(k));
    if (!known) console.error('decide_request failed', error.code, error.message);
    return { error: known ? messages[known] : 'We could not save this. Try again.' };
  }
  revalidatePath('/coach/clients');
  return {};
}

export type AssignState = { error?: string; done?: 'assigned' | 'already' };

const assignMessages: Record<string, string> = {
  not_active: 'This client is no longer paying, so you cannot assign a program.',
  not_published: 'Publish this program before you assign it.',
  left_program: 'They left this program. Message them before you assign it again.',
  not_live: 'Your profile is not live, so you cannot assign programs.',
};

/** The coach assigns one of their published programs to a paying client. */
export async function assignProgram(_prev: AssignState, formData: FormData): Promise<AssignState> {
  await requireRole('coach');
  const engagement = String(formData.get('engagement') ?? '');
  const program = String(formData.get('program') ?? '');
  if (!isUuid(engagement) || !isUuid(program)) return { error: 'Choose a program to assign.' };
  const supabase = await supabaseServer();
  const { data, error } = await supabase.rpc('assign_program', { engagement, program }).single();
  if (error) {
    const known = Object.keys(assignMessages).find((k) => error.message.includes(k));
    if (!known) console.error('assign_program failed', error.code, error.message);
    return { error: known ? assignMessages[known] : 'We could not assign this. Try again.' };
  }
  revalidatePath('/coach/clients');
  revalidatePath('/coach/programs');
  return { done: data.created ? 'assigned' : 'already' };
}
