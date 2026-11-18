'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { supabaseServer } from '@/lib/supabase/server';
import { requireRole } from '@/lib/viewer';

/** Reset the invite link: the old code stops working at once; people who joined stay in. */
export async function resetInvite(formData: FormData) {
  await requireRole('coach');
  const id = String(formData.get('id') ?? '');
  if (!/^[0-9a-f-]{36}$/.test(id)) redirect('/coach/programs');
  const supabase = await supabaseServer();
  const { error } = await supabase.rpc('reset_invite', { program: id });
  if (error) {
    console.error('reset_invite failed', error.code, error.message);
    redirect(`/coach/programs/${id}/invite?reset=failed`);
  }
  revalidatePath(`/coach/programs/${id}/invite`);
  redirect(`/coach/programs/${id}/invite?reset=1`);
}
