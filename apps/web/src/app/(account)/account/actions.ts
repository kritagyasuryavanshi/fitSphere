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

// why_not_delete_my_account answers, and what delete_my_account raises, as the delete screen's error codes.
const BLOCKED: Record<string, string> = { admin: 'admin', renewing: 'coaching', clients: 'clients', payouts: 'payouts' };
const RAISED: Record<string, string> = {
  admin_cannot_delete: 'admin',
  cancel_coaching_first: 'coaching',
  coach_has_clients: 'clients',
  payouts_due: 'payouts',
};

export async function logOut(): Promise<void> {
  await requireSignedIn();
  await (await supabaseServer()).auth.signOut();
  redirect('/');
}

/** Runs only from the confirm screen. The database removes the account and everything personal keyed to it. */
export async function deleteAccount(): Promise<void> {
  const viewer = await requireSignedIn();
  const supabase = await supabaseServer();
  // Ask first, before anything is removed: an admin, renewing coaching or paying clients stop the deletion.
  const why = await supabase.rpc('why_not_delete_my_account');
  if (why.error) throw new Error(`Could not check the account: ${why.error.message}`);
  if (why.data === 'signed_out') redirect('/sign-in');
  if (why.data) {
    if (!BLOCKED[why.data]) throw new Error(`Unknown reason the account cannot be deleted: ${why.data}`);
    redirect(`/account/delete?error=${BLOCKED[why.data]}`);
  }
  // Storage rows do not cascade from the account, and Supabase refuses SQL deletes on them: remove a coach's
  // credential files (their own folder, allowed by the delete policy) through the Storage API first.
  // Withdraw them first: a pending or checked credential's file cannot be deleted (the badge rests on it).
  const withdrawn = await supabase.rpc('withdraw_my_credentials');
  if (withdrawn.error) throw new Error(`Could not withdraw credentials: ${withdrawn.error.message}`);
  // A page of up to 1,000 at a time, until none are left: each removal shortens the list. A file the storage policy
  // keeps (a credential that turned pending meanwhile) removes nothing and returns no error, so stop and refuse.
  for (let page = 0; page < 100; page++) {
    const files = await supabase.storage.from('credentials').list(viewer.userId, { limit: 1000 });
    if (files.error) throw new Error(`Could not list credential files: ${files.error.message}`);
    if (!files.data.length) break;
    const removed = await supabase.storage.from('credentials').remove(files.data.map((f) => `${viewer.userId}/${f.name}`));
    if (removed.error) throw new Error(`Could not delete credential files: ${removed.error.message}`);
    if (!removed.data.length) break;
  }
  const left = await supabase.storage.from('credentials').list(viewer.userId, { limit: 1 });
  if (left.error) throw new Error(`Could not list credential files: ${left.error.message}`);
  if (left.data.length) throw new Error('Some credential files could not be deleted, so the account was kept. Try again.');
  const { error } = await supabase.rpc('delete_my_account');
  const raised = Object.keys(RAISED).find((k) => error?.message.includes(k));
  if (raised) redirect(`/account/delete?error=${RAISED[raised]}`);
  if (error) throw new Error(`Could not delete the account: ${error.message}`);
  // The account is gone; clear this browser's session cookies without asking the server about a deleted user.
  await supabase.auth.signOut({ scope: 'local' });
  redirect('/?deleted=1');
}
