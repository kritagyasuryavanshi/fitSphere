'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { isUuid } from '@/lib/programs';
import { isIsoDate } from '@/lib/session-player';
import { supabaseServer } from '@/lib/supabase/server';
import { requireRole } from '@/lib/viewer';

export type DrillLog = { session: string; date: string; position: number; rounds: number | null; technique: number; effort: number; note: string };
export type ActionResult = { error: string } | { ok: true };

const whole = (n: unknown, min: number, max: number) => Number.isInteger(n) && (n as number) >= min && (n as number) <= max;

/** Saves one drill. The database checks the session is scheduled for this athlete on this date. */
export async function logDrill(input: DrillLog): Promise<ActionResult> {
  await requireRole('athlete');
  if (
    !isUuid(input.session) ||
    !isIsoDate(input.date) ||
    !whole(input.position, 1, 1000) ||
    !(input.rounds === null || whole(input.rounds, 0, 30)) ||
    !whole(input.technique, 1, 5) ||
    !whole(input.effort, 1, 10) ||
    typeof input.note !== 'string' ||
    input.note.length > 500
  ) {
    return { error: 'Pick a technique feel and an effort, and keep the note under 500 characters.' };
  }
  const supabase = await supabaseServer();
  const { error } = await supabase.rpc('log_drill', {
    session: input.session,
    on_date: input.date,
    item_position: input.position,
    rounds_done: input.rounds as number,
    technique: input.technique,
    effort: input.effort,
    note: input.note,
  });
  if (error) {
    if (error.message.includes('not_scheduled')) return { error: 'This session is no longer in your programs. Your earlier drills are saved.' };
    if (error.message.includes('bad_log')) return { error: 'Those numbers do not fit this drill. Check the rounds and try again.' };
    console.error('log_drill failed', error.code, error.message);
    return { error: 'We could not save this drill. Check your connection and try again.' };
  }
  revalidatePath('/today');
  revalidatePath(`/session/${input.session}`);
  return { ok: true };
}

export type SetLog = { session: string; date: string; position: number; setNo: number; reps: number; loadKg: number | null; rpe: number };

/** Saves one set of an exercise. The database checks the session is scheduled for this athlete on this date. */
export async function logSet(input: SetLog): Promise<ActionResult> {
  await requireRole('athlete');
  if (
    !isUuid(input.session) ||
    !isIsoDate(input.date) ||
    !whole(input.position, 1, 1000) ||
    !whole(input.setNo, 1, 20) ||
    !whole(input.reps, 0, 200) ||
    !(input.loadKg === null || (typeof input.loadKg === 'number' && input.loadKg >= 0 && input.loadKg <= 500 && Math.round(input.loadKg * 100) === input.loadKg * 100)) ||
    !whole(input.rpe, 1, 10)
  ) {
    return { error: 'Enter reps from 0 to 200, a load up to 500 kg with at most two decimals, and how hard it was.' };
  }
  const supabase = await supabaseServer();
  const { error } = await supabase.rpc('log_set', {
    session: input.session,
    on_date: input.date,
    item_position: input.position,
    set_no: input.setNo,
    reps: input.reps,
    load_kg: input.loadKg as number,
    rpe: input.rpe,
  });
  if (error) {
    if (error.message.includes('not_scheduled')) return { error: 'This session is no longer in your programs. Your earlier sets are saved.' };
    if (error.message.includes('bad_log')) return { error: 'Those numbers do not fit this set. Check reps and load and try again.' };
    console.error('log_set failed', error.code, error.message);
    return { error: 'We could not save this set. Check your connection and try again.' };
  }
  revalidatePath('/today');
  revalidatePath(`/session/${input.session}`);
  return { ok: true };
}

/** Marks the session done and returns to Today. */
export async function finishSession(session: string, date: string): Promise<ActionResult> {
  await requireRole('athlete');
  if (!isUuid(session) || !isIsoDate(date)) return { error: 'We could not finish this session.' };
  const supabase = await supabaseServer();
  const { error } = await supabase.rpc('finish_session', { session, on_date: date });
  if (error) {
    if (error.message.includes('nothing_logged')) return { error: 'Log at least one drill to finish the session.' };
    if (error.message.includes('not_scheduled')) return { error: 'This session is no longer in your programs.' };
    console.error('finish_session failed', error.code, error.message);
    return { error: 'We could not finish this session. Check your connection and try again.' };
  }
  revalidatePath('/today');
  revalidatePath(`/session/${session}`);
  redirect('/today');
}
