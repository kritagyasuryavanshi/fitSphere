'use server';

import { redirect } from 'next/navigation';
import { supabaseServer } from '@/lib/supabase/server';
import { getViewer } from '@/lib/viewer';

export type JoinState = { error?: string };

const messages: Record<string, string> = {
  invite_inactive: 'This invite link is no longer active. Ask your coach for a new one.',
  not_published: 'This program is not open yet. Ask your coach when it starts.',
  own_program: 'This is your own program, so you cannot join it.',
  removed_from_program: 'Your coach removed you from this program, so this link does not work for you.',
};

/** Join through an invite link. The database checks the link, the sign-up and the program again. */
export async function joinProgram(_prev: JoinState, formData: FormData): Promise<JoinState> {
  const code = String(formData.get('code') ?? '');
  if (!/^[0-9a-f]{32}$/.test(code)) return { error: messages.invite_inactive };
  const viewer = await getViewer();
  if (!viewer) redirect('/sign-in');
  if (viewer.nextStep) redirect(viewer.nextStep);
  const supabase = await supabaseServer();
  const { error } = await supabase.rpc('join_program', { code });
  if (error) {
    const known = Object.keys(messages).find((k) => error.message.includes(k));
    if (!known) console.error('join_program failed', error.code, error.message);
    return { error: known ? messages[known] : 'We could not add you to this program. Try again.' };
  }
  redirect(`/join/${code}?joined=1`);
}
