'use server';

import { redirect } from 'next/navigation';
import { supabaseServer } from '@/lib/supabase/server';
import { requireSignedIn } from '@/lib/viewer';

/** Where to go back to: only a path on this site, never another site. */
function safeBack(value: FormDataEntryValue | null): string {
  const s = String(value ?? '');
  return s.startsWith('/') && !s.startsWith('//') && !s.includes('\\') ? s.split('#')[0]! : '/';
}

/** M4-18: reports a review, a message or a coach. The database checks the person can see it. */
export async function reportContent(formData: FormData): Promise<void> {
  await requireSignedIn();
  const back = safeBack(formData.get('back'));
  const sep = back.includes('?') ? '&' : '?';
  const { error } = await (await supabaseServer()).rpc('report_content', {
    kind: String(formData.get('kind') ?? ''),
    target: String(formData.get('target') ?? '').slice(0, 64),
    reason: String(formData.get('reason') ?? ''),
    note: String(formData.get('note') ?? '').slice(0, 500) || undefined,
  });
  if (error) console.error('report_content failed', error.code, error.message);
  redirect(`${back}${sep}${error ? 'report=failed' : 'report=sent'}`);
}
