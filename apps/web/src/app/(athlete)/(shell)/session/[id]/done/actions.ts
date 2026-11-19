'use server';

import { revalidatePath } from 'next/cache';
import { isUuid } from '@/lib/programs';
import { isIsoDate } from '@/lib/session-player';
import { supabaseServer } from '@/lib/supabase/server';
import { requireRole } from '@/lib/viewer';

export type NoteResult = { error: string } | { saved: string };

/** Saves the athlete's note to their coach on the session's log. */
export async function saveNote(session: string, date: string, note: string): Promise<NoteResult> {
  await requireRole('athlete');
  if (!isUuid(session) || !isIsoDate(date) || typeof note !== 'string') return { error: 'We could not save your note.' };
  if (note.trim().length > 1000) return { error: 'Keep the note under 1,000 characters.' };
  const supabase = await supabaseServer();
  const { error } = await supabase.rpc('save_session_note', { session, on_date: date, note });
  if (error) {
    console.error('save_session_note failed', error.code, error.message);
    return { error: 'We could not save your note. Check your connection and try again.' };
  }
  revalidatePath(`/session/${session}/done`);
  return { saved: note.trim() };
}
