// M6-11: Cloudflare Turnstile on sign-in. The widget puts its token in the form; Supabase Auth checks it once captcha
// is switched on in the hosted project. Without a site key nothing renders and no token is sent.
export const TURNSTILE_FIELD = 'cf-turnstile-response';

/** The widget's token from a submitted form, or undefined. Real tokens are well under 2,048 characters. */
export function captchaToken(form: FormData): string | undefined {
  const value = form.get(TURNSTILE_FIELD);
  return typeof value === 'string' && value.length > 0 && value.length <= 2048 ? value : undefined;
}

/** Options for signInWithOtp: the callback, plus the captcha token only when there is one. */
export function otpOptions(emailRedirectTo: string, token: string | undefined) {
  return token ? { emailRedirectTo, captchaToken: token } : { emailRedirectTo };
}
