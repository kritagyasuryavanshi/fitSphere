'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { supabaseServer } from '@/lib/supabase/server';
import { requireSignedIn } from '@/lib/viewer';
import { aiSwitches } from '../../welcome/options';

export type NameState = { name?: string; message?: string; error?: string };

export async function saveName(_prev: NameState, formData: FormData): Promise<NameState> {
  const viewer = await requireSignedIn();
  const name = String(formData.get('name') ?? '').trim();
  if (!name || name.length > 80) return { name, error: 'Enter your first name, up to 80 characters' };
  // RLS lets a person update only their own display_name.
  const { error } = await (await supabaseServer()).from('profiles').update({ display_name: name }).eq('id', viewer.userId);
  if (error) return { name, error: 'We could not save this. Try again.' };
  revalidatePath('/account');
  return { name, message: 'Saved.' };
}

/** A consent switch. The server records it against the current notice; the newest row is the answer, so off is at once. */
export async function setConsent(formData: FormData): Promise<void> {
  await requireSignedIn();
  const purpose = aiSwitches.find((s) => s.purpose === formData.get('purpose'))?.purpose;
  if (!purpose) return;
  const { error } = await (await supabaseServer()).rpc('set_my_consent', { purpose, granted: formData.get('on') === 'yes' });
  if (error) throw new Error(`Could not save the setting: ${error.message}`);
  revalidatePath('/account');
}

export async function logOut(): Promise<void> {
  await requireSignedIn();
  await (await supabaseServer()).auth.signOut();
  redirect('/');
}

/** Runs only from the confirm screen. The database removes the account and everything personal keyed to it. */
export async function deleteAccount(): Promise<void> {
  await requireSignedIn();
  const supabase = await supabaseServer();
  const { error } = await supabase.rpc('delete_my_account');
  if (error?.message === 'admin_cannot_delete') redirect('/account/delete?error=admin');
  if (error) throw new Error(`Could not delete the account: ${error.message}`);
  // The account is gone; clear this browser's session cookies without asking the server about a deleted user.
  await supabase.auth.signOut({ scope: 'local' });
  redirect('/?deleted=1');
}
