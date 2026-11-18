'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { isUuid } from '@/lib/programs';
import { supabaseServer } from '@/lib/supabase/server';
import { requireRole } from '@/lib/viewer';

/** The coach removes an athlete. Access to their data ends at once, and no invite link lets them back in. */
export async function removeAthlete(formData: FormData) {
  await requireRole('coach');
  // The form's program only builds the way back; the database names the program the enrollment belongs to.
  const back = String(formData.get('program') ?? '');
  const enrollment = String(formData.get('enrollment') ?? '');
  if (!isUuid(back) || !isUuid(enrollment)) redirect('/coach/programs');
  const supabase = await supabaseServer();
  const { data: program, error } = await supabase.rpc('remove_athlete', { enrollment });
  if (error) {
    // They left in the meantime: nothing was removed, so say so rather than promise the link stays closed.
    const gone = error.message.includes('not_active');
    if (!gone) console.error('remove_athlete failed', error.code, error.message);
    revalidatePath(`/coach/programs/${back}/invite`);
    redirect(gone ? `/coach/programs/${back}/invite?removed=gone` : `/coach/programs/${back}/members/${enrollment}/remove?error=1`);
  }
  revalidatePath(`/coach/programs/${program}/invite`);
  revalidatePath('/coach/programs');
  redirect(`/coach/programs/${program}/invite?removed=1`);
}
