'use server';

import type { Database } from '@fitsphere/db';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { supabaseServer } from '@/lib/supabase/server';
import { requireRole } from '@/lib/viewer';

export type ProgramState = { error?: string; field?: string };

const uuid = /^[0-9a-f-]{36}$/;

const messages: Record<string, [string, string]> = {
  title_required: ['Give the program a name.', 'title'],
  bad_category: ['Choose a sport.', 'category'],
  bad_weeks: ['A program runs 1 to 26 weeks.', 'weeks'],
  bad_day: ['A session sits in a week past the end of the program. Move it or add weeks.', ''],
  bad_sessions: ['A program holds up to 200 sessions.', ''],
  bad_items: ['A session holds up to 30 drills and exercises.', ''],
  item_not_published: ['A drill in this program is no longer in the library. Remove it and try again.', ''],
  bad_prescription: ['One of the numbers is out of range. Check the drills marked in red.', ''],
  empty_program: ['Add at least one session before you publish.', ''],
  not_owner: ['Only the coach who made this program can change it.', ''],
};
const known = (e: { message: string }) => Object.keys(messages).find((k) => e.message.includes(k));
const fail = (e: { code?: string; message: string }, what: string): ProgramState => {
  if (!known(e)) console.error(`${what} failed`, e.code, e.message);
  const [error, field] = messages[known(e) ?? ''] ?? ['We could not save this. Try again.', ''];
  return { error, field };
};

/** New program: a name and a sport, then the builder. */
export async function createProgram(_prev: ProgramState, formData: FormData): Promise<ProgramState> {
  await requireRole('coach');
  const supabase = await supabaseServer();
  const { data, error } = await supabase.rpc('create_program', {
    title: String(formData.get('title') ?? ''),
    category: String(formData.get('category') ?? ''),
  });
  if (error) return fail(error, 'create_program');
  revalidatePath('/coach/programs');
  redirect(`/coach/programs/${data}`);
}

/** Save draft or Publish changes. The builder sends its whole state; the database checks every number again. */
export async function saveProgram(_prev: ProgramState, formData: FormData): Promise<ProgramState> {
  await requireRole('coach');
  const id = String(formData.get('id') ?? '');
  if (!uuid.test(id)) return { error: 'This program could not be found.' };
  let sessions: Database['public']['Functions']['save_program_draft']['Args']['sessions'];
  try {
    sessions = JSON.parse(String(formData.get('sessions') ?? '[]'));
  } catch {
    return { error: 'We could not read the sessions. Reload the page and try again.' };
  }
  const supabase = await supabaseServer();
  const { error } = await supabase.rpc('save_program_draft', {
    program: id,
    title: String(formData.get('title') ?? ''),
    summary: String(formData.get('summary') ?? ''),
    weeks: Number(formData.get('weeks')),
    sessions,
  });
  if (error) return fail(error, 'save_program_draft');
  revalidatePath('/coach/programs');
  if (formData.get('intent') === 'publish') {
    const { data: version, error: publishError } = await supabase.rpc('publish_program', { program: id });
    if (publishError) return fail(publishError, 'publish_program');
    redirect(`/coach/programs?published=${version}`);
  }
  redirect(`/coach/programs/${id}?saved=1`);
}
