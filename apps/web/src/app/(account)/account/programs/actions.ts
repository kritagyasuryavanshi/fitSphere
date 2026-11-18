'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { isUuid } from '@/lib/programs';
import { supabaseServer } from '@/lib/supabase/server';
import { requireSignedIn } from '@/lib/viewer';

/** The athlete leaves a program. The coach's access to their data ends in the same statement. */
export async function leaveProgram(formData: FormData) {
  await requireSignedIn();
  const id = String(formData.get('enrollment') ?? '');
  if (!isUuid(id)) redirect('/account/programs');
  const supabase = await supabaseServer();
  const { error } = await supabase.rpc('leave_program', { enrollment: id });
  // Already ended (another tab) counts as done; anything else goes back with the error.
  if (error && !error.message.includes('not_active')) {
    console.error('leave_program failed', error.code, error.message);
    redirect(`/account/programs/${id}/leave?error=1`);
  }
  revalidatePath('/account/programs');
  redirect('/account/programs?left=1');
}
