'use server';

import { normaliseEmail } from '@fitsphere/core';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { supabaseServer } from '@/lib/supabase/server';

// The typed email goes back with the error, so the field keeps it.
export type SendLinkState = { email?: string; error?: string };

const INVALID_EMAIL = 'Enter a full email address, like kabir@example.com';

// Production sets NEXT_PUBLIC_SITE_URL. Previews and local use the request origin, which the Supabase allow-list checks.
async function callbackUrl() {
  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? (await headers()).get('origin') ?? 'http://localhost:3000';
  return `${origin}/auth/callback`;
}

async function sendLink(email: string): Promise<string | undefined> {
  const supabase = await supabaseServer();
  const send = async () => supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: await callbackUrl() } });
  let { error } = await send();
  // Two requests for a new address at once make Supabase fail one of them on a duplicate user.
  // The other one created the user, so a single retry sends the link.
  if (error && error.status === 500) ({ error } = await send());
  if (!error) return undefined;
  return error.status === 429 ? 'Too many sign-in emails. Wait a few minutes, then try again.' : 'We could not send the link. Try again.';
}

export async function requestLink(_prev: SendLinkState, formData: FormData): Promise<SendLinkState> {
  const typed = String(formData.get('email') ?? '');
  const email = normaliseEmail(typed);
  if (!email) return { email: typed, error: INVALID_EMAIL };
  const error = await sendLink(email);
  if (error) return { email: typed, error };
  redirect(`/check-email?email=${encodeURIComponent(email)}`);
}

export async function resendLink(email: string): Promise<string | undefined> {
  const valid = normaliseEmail(email);
  return valid ? sendLink(valid) : INVALID_EMAIL;
}

export async function signInWithGoogle() {
  const supabase = await supabaseServer();
  const { data, error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: await callbackUrl() } });
  redirect(error || !data.url ? '/sign-in?error=google' : data.url);
}
