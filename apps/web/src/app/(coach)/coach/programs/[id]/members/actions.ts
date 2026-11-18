'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { isUuid } from '@/lib/programs';
import { supabaseServer } from '@/lib/supabase/server';
import { requireRole } from '@/lib/viewer';

/** The coach removes an athlete. Access to their data ends at once, and no invite link lets them back in. */
export async function removeAthlete(formData: FormData) {
  await requireRole('coach');
  const program = String(formData.get('program') ?? '');
  const enrollment = String(formData.get('enrollment') ?? '');
  if (!isUuid(program) || !isUuid(enrollment)) redirect('/coach/programs');
  const supabase = await supabaseServer();
  const { error } = await supabase.rpc('remove_athlete', { enrollment });
  if (error && !error.message.includes('not_active')) {
    console.error('remove_athlete failed', error.code, error.message);
    redirect(`/coach/programs/${program}/members/${enrollment}/remove?error=1`);
  }
  revalidatePath(`/coach/programs/${program}/invite`);
  revalidatePath('/coach/programs');
  redirect(`/coach/programs/${program}/invite?removed=1`);
}
