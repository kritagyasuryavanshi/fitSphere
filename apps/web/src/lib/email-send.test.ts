import { describe, expect, it } from 'vitest';
import { mailProvider } from './email-send';

describe('mailProvider', () => {
  it('uses Gmail SMTP when its login is set', () => {
    expect(mailProvider({ SMTP_USER: 'a@gmail.com', SMTP_PASS: 'x' })).toEqual({ kind: 'smtp', from: 'FitSphere <a@gmail.com>' });
  });
  it('keeps a chosen sender name', () => {
    expect(mailProvider({ SMTP_USER: 'a@gmail.com', SMTP_PASS: 'x', EMAIL_FROM: 'Fit <a@gmail.com>' })).toEqual({ kind: 'smtp', from: 'Fit <a@gmail.com>' });
  });
  it('uses Resend when its key and sender are set', () => {
    expect(mailProvider({ RESEND_API_KEY: 'k', EMAIL_FROM: 'x@fit.in' })).toEqual({ kind: 'resend', from: 'x@fit.in' });
  });
  it('sends nothing when neither is complete', () => {
    expect(mailProvider({ SMTP_USER: 'a@gmail.com' })).toBeNull();
    expect(mailProvider({ RESEND_API_KEY: 'k' })).toBeNull();
    expect(mailProvider({})).toBeNull();
  });
});
