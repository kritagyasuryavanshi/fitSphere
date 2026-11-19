'use server';

import { revalidatePath } from 'next/cache';
import { supabaseServer } from '@/lib/supabase/server';
import { requireSignedIn } from '@/lib/viewer';

/** Mark all as read. The database only ever touches the caller's own notifications. */
export async function markAllRead(): Promise<void> {
  await requireSignedIn();
  const supabase = await supabaseServer();
  const { error } = await supabase.rpc('mark_notifications_read', {});
  if (error) throw new Error(`Could not mark notifications read: ${error.message}`);
  revalidatePath('/account/notifications');
}
