'use server';

import { revalidatePath } from 'next/cache';
import { supabaseServer } from '@/lib/supabase/server';
import { requireRole } from '@/lib/viewer';

const messages: Record<string, string> = {
  bad_path: 'That file name is not allowed. Upload it again.',
  no_file: 'The upload did not finish. Try again.',
  bad_credential: 'Give the credential a title, up to 120 characters.',
  not_coach: 'Only coaches can add credentials.',
};

/** Makes sure the coach has a profile row, so the bucket accepts their upload. A draft, nothing public. */
export async function ensureCoachProfile(): Promise<{ error?: string }> {
  const viewer = await requireRole('coach');
  const supabase = await supabaseServer();
  const { data, error } = await supabase.from('coach_profiles').select('coach_id').eq('coach_id', viewer.userId).maybeSingle();
  if (error) return { error: 'We could not prepare your profile. Try again.' };
  if (!data) {
    const made = await supabase.rpc('save_coach_profile', { headline: '', philosophy: '', specialties: [], languages: [], formats: [], city: '', years: 0, client_limit: 10 });
    if (made.error) return { error: 'We could not prepare your profile. Try again.' };
  }
  return {};
}

/** Records a credential whose file the browser already uploaded into the coach's own folder. */
export async function submitCredential(input: { title: string; issuer: string; idNumber: string; path: string }): Promise<{ error?: string }> {
  await requireRole('coach');
  const supabase = await supabaseServer();
  const { error } = await supabase.rpc('submit_credential', { title: input.title, file_path: input.path, issuer: input.issuer, id_number: input.idNumber });
  if (error) {
    const known = Object.keys(messages).find((k) => error.message.includes(k));
    if (!known) console.error('submit_credential failed', error.code, error.message);
    return { error: known ? messages[known] : 'We could not save the credential. Try again.' };
  }
  revalidatePath('/coach/credentials');
  return {};
}

/** Removes a credential: withdraws it (the badge goes), then deletes its file, which the bucket allows only then. */
export async function removeCredential(formData: FormData): Promise<void> {
  const viewer = await requireRole('coach');
  const id = String(formData.get('credential') ?? '');
  const supabase = await supabaseServer();
  const { data, error } = await supabase.from('credentials').select('file_path').eq('id', id).eq('coach_id', viewer.userId).maybeSingle();
  if (error || !data) throw new Error('This credential could not be found.');
  const withdrawn = await supabase.rpc('withdraw_credential', { credential: id });
  if (withdrawn.error) throw new Error(`Could not remove the credential: ${withdrawn.error.message}`);
  const removed = await supabase.storage.from('credentials').remove([data.file_path]);
  if (removed.error) console.error('credential file not removed', removed.error.message);
  revalidatePath('/coach/credentials');
}
