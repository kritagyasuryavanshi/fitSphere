'use server';

import { redirect } from 'next/navigation';
import { isUuid } from '@/lib/programs';
import { supabaseServer } from '@/lib/supabase/server';
import { requireRole } from '@/lib/viewer';

// fields: what was typed, sent back on an error so the form can refill it (React resets a form after its action).
export type HireState = { error?: string; fields?: Record<string, string> };

const messages: Record<string, string> = {
  coach_full: 'This coach is not taking new clients right now.',
  already_open: 'You already have an open request or coaching with this coach.',
  not_available: 'This package is not available any more.',
  bad_request: 'Choose a package, a start date from today to 60 days ahead, and how many days you can train.',
  own_profile: 'This is your own profile.',
};

/** Sends a hire request. Nothing is charged: the athlete pays only after the coach accepts. */
export async function requestCoaching(_prev: HireState, formData: FormData): Promise<HireState> {
  await requireRole('athlete');
  const fields = Object.fromEntries([...formData.entries()].map(([k, v]) => [k, String(v)]));
  const pkg = String(formData.get('package') ?? '');
  const start = String(formData.get('start') ?? '');
  if (!isUuid(pkg) || !/^\d{4}-\d{2}-\d{2}$/.test(start)) return { error: messages.bad_request, fields };
  const supabase = await supabaseServer();
  const { error } = await supabase.rpc('request_coaching', {
    package: pkg,
    start,
    days: Number(formData.get('days')),
    goals: String(formData.get('goals') ?? ''),
    share: formData.get('share') === 'on',
  });
  if (error) {
    const known = Object.keys(messages).find((k) => error.message.includes(k));
    if (!known) console.error('request_coaching failed', error.code, error.message);
    return { error: known ? messages[known] : 'We could not send the request. Try again.', fields };
  }
  redirect('/coaching');
}
