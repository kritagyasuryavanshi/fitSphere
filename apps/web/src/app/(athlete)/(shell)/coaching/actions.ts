'use server';

import { revalidatePath } from 'next/cache';
import { isUuid } from '@/lib/programs';
import { supabaseServer } from '@/lib/supabase/server';
import { requireRole } from '@/lib/viewer';

/** The athlete withdraws a request before paying. */
export async function withdrawRequest(formData: FormData): Promise<void> {
  await requireRole('athlete');
  const id = String(formData.get('engagement') ?? '');
  if (!isUuid(id)) return;
  const supabase = await supabaseServer();
  const { error } = await supabase.rpc('withdraw_request', { engagement: id });
  // not_open: it was already decided or withdrawn; the page shows the current state.
  if (error && !error.message.includes('not_open')) throw error;
  revalidatePath('/coaching');
}
