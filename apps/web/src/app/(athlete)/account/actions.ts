'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { supabaseServer } from '@/lib/supabase/server';
import { requireRole } from '@/lib/viewer';
import { AI_METRICS_NOTICE, AI_NOTES_NOTICE } from '../../welcome/options';

export type NameState = { name?: string; message?: string; error?: string };

export async function saveName(_prev: NameState, formData: FormData): Promise<NameState> {
  const viewer = await requireRole('athlete');
  const name = String(formData.get('name') ?? '').trim();
  if (!name || name.length > 80) return { name, error: 'Enter your first name, up to 80 characters' };
  // RLS lets a person update only their own display_name.
  const { error } = await (await supabaseServer()).from('profiles').update({ display_name: name }).eq('id', viewer.userId);
  if (error) return { name, error: 'We could not save this. Try again.' };
  revalidatePath('/account');
  return { name, message: 'Saved.' };
}

// Each switch maps to one consent purpose and the notice text shown next to it.
const switches = {
  ai_health_personalisation: AI_NOTES_NOTICE,
  ai_body_metrics: AI_METRICS_NOTICE,
} as const;

/** A consent switch. The new row is the answer every reader uses, so turning it off takes effect at once. */
export async function setConsent(formData: FormData): Promise<void> {
  await requireRole('athlete');
  const purpose = String(formData.get('purpose') ?? '');
  if (!(purpose in switches)) return;
  const key = purpose as keyof typeof switches;
  const { error } = await (await supabaseServer()).rpc('set_my_consent', { purpose: key, granted: formData.get('on') === 'yes', notice: switches[key] });
  if (error) throw new Error(`Could not save the setting: ${error.message}`);
  revalidatePath('/account');
}

export async function logOut(): Promise<void> {
  await requireRole('athlete');
  await (await supabaseServer()).auth.signOut();
  redirect('/');
}

/** Runs only from the confirm screen. The database removes the account and everything personal keyed to it. */
export async function deleteAccount(): Promise<void> {
  await requireRole('athlete');
  const supabase = await supabaseServer();
  const { error } = await supabase.rpc('delete_my_account');
  if (error?.message === 'admin_cannot_delete') redirect('/account/delete?error=admin');
  if (error) throw new Error(`Could not delete the account: ${error.message}`);
  // The account is gone; clear this browser's session cookies without asking the server about a deleted user.
  await supabase.auth.signOut({ scope: 'local' });
  redirect('/?deleted=1');
}
