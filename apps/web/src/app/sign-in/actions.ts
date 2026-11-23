'use server';

import { normaliseEmail } from '@fitsphere/core';
import { redirect } from 'next/navigation';
import { captchaToken, otpOptions } from '@/lib/captcha';
import { siteOrigin } from '@/lib/site-origin';
import { supabaseServer } from '@/lib/supabase/server';

// The typed email goes back with the error, so the field keeps it.
export type SendLinkState = { email?: string; error?: string };

const INVALID_EMAIL = 'Enter a full email address, like kabir@example.com';

// The Supabase redirect allow-list checks this origin (lib/site-origin.ts).
async function callbackUrl() {
  return `${await siteOrigin()}/auth/callback`;
}

async function sendLink(email: string, captcha?: string): Promise<string | undefined> {
  const supabase = await supabaseServer();
  const send = async () => supabase.auth.signInWithOtp({ email, options: otpOptions(await callbackUrl(), captcha) });
  let { error } = await send();
  // Two requests for a new address at once make Supabase fail one of them on a duplicate user.
  // The other one created the user, so a single retry sends the link.
  if (error && error.status === 500) ({ error } = await send());
  if (!error) return undefined;
  // A missing or used-up Turnstile token, once captcha is on in Supabase Auth (M6-11).
  if (error.code === 'captcha_failed') return 'Complete the check above the button, then try again.';
  return error.status === 429 ? 'Too many sign-in emails. Wait a few minutes, then try again.' : 'We could not send the link. Try again.';
}

export async function requestLink(_prev: SendLinkState, formData: FormData): Promise<SendLinkState> {
  const typed = String(formData.get('email') ?? '');
  const email = normaliseEmail(typed);
  if (!email) return { email: typed, error: INVALID_EMAIL };
  const error = await sendLink(email, captchaToken(formData));
  if (error) return { email: typed, error };
  redirect(`/check-email?email=${encodeURIComponent(email)}`);
}

export async function resendLink(email: string, captcha?: string): Promise<string | undefined> {
  const valid = normaliseEmail(email);
  return valid ? sendLink(valid, captcha && captcha.length <= 2048 ? captcha : undefined) : INVALID_EMAIL;
}

export async function signInWithGoogle() {
  const supabase = await supabaseServer();
  const { data, error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: await callbackUrl() } });
  redirect(error || !data.url ? '/sign-in?error=google' : data.url);
}
