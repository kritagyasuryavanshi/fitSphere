import { describe, expect, it } from 'vitest';
import { captchaToken, otpOptions } from './captcha';

describe('sign-in captcha (M6-11)', () => {
  it('sends the token with the email link request when the form has one', () => {
    expect(otpOptions('https://x.test/auth/callback', 'tok')).toEqual({ emailRedirectTo: 'https://x.test/auth/callback', captchaToken: 'tok' });
  });

  it('sends no captcha field when there is no token, so sign-in works before Turnstile is set up', () => {
    expect(otpOptions('https://x.test/auth/callback', undefined)).toEqual({ emailRedirectTo: 'https://x.test/auth/callback' });
  });

  it('reads the widget field from a form, ignoring an empty or overlong value', () => {
    const form = (v?: string) => {
      const f = new FormData();
      if (v !== undefined) f.set('cf-turnstile-response', v);
      return f;
    };
    expect(captchaToken(form('abc'))).toBe('abc');
    expect(captchaToken(form(''))).toBeUndefined();
    expect(captchaToken(form())).toBeUndefined();
    expect(captchaToken(form('x'.repeat(3000)))).toBeUndefined();
  });
});
