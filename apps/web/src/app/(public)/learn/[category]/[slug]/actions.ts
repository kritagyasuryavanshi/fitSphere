'use server';

import { revalidatePath } from 'next/cache';
import { supabaseServer } from '@/lib/supabase/server';
import { requireSignedIn } from '@/lib/viewer';

const uuid = /^[0-9a-f-]{36}$/;

/** Save or unsave, complete or un-complete. The database checks the item is published and writes only the caller's row. */
export async function toggleProgress(formData: FormData): Promise<void> {
  await requireSignedIn();
  const item = String(formData.get('item') ?? '');
  const what = formData.get('what');
  const on = formData.get('on') === 'yes';
  if (!uuid.test(item) || (what !== 'saved' && what !== 'completed')) return;
  const supabase = await supabaseServer();
  const { error } = what === 'saved' ? await supabase.rpc('set_saved', { item, saved: on }) : await supabase.rpc('set_completed', { item, done: on });
  if (error) throw new Error(`Could not save this: ${error.message}`);
  // Revalidate only a lesson path; the form field is client data.
  const path = String(formData.get('path') ?? '');
  if (/^\/learn\/[a-z0-9_-]+\/[a-z0-9-]+$/.test(path)) revalidatePath(path);
  revalidatePath('/account/saved');
}
