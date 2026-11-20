import { describe, expect, it } from 'vitest';
import { fakePaymentsAllowed, paymentsProvider } from './provider';
import { signBody, verifySignature } from './signature';

describe('webhook signatures', () => {
  it('accept the exact signature of the body and nothing else', () => {
    const body = '{"event":"payment.captured"}';
    const sig = signBody(body, 'secret');
    expect(verifySignature(body, sig, 'secret')).toBe(true);
    expect(verifySignature(body + ' ', sig, 'secret')).toBe(false);
    expect(verifySignature(body, sig, 'other')).toBe(false);
    expect(verifySignature(body, sig.slice(0, -1), 'secret')).toBe(false);
    expect(verifySignature(body, null, 'secret')).toBe(false);
    expect(verifySignature(body, sig, undefined)).toBe(false);
  });
});

describe('the fake payment provider', () => {
  const on = { PAYMENTS_PROVIDER: 'fake', PAYMENTS_WEBHOOK_SECRET: 's', E2E_AUTH_CONFIRM: '1' } as unknown as NodeJS.ProcessEnv;
  it('runs only when asked for, with a secret, and never in production', () => {
    expect(fakePaymentsAllowed(on)).toBe(true);
    expect(fakePaymentsAllowed({ ...on, VERCEL_ENV: 'preview' })).toBe(true);
    expect(fakePaymentsAllowed({ ...on, VERCEL_ENV: 'production' })).toBe(false);
    expect(fakePaymentsAllowed({ ...on, PAYMENTS_WEBHOOK_SECRET: '' })).toBe(false);
    // A production server off Vercel (no VERCEL_ENV) and not the test server stays closed.
    expect(fakePaymentsAllowed({ PAYMENTS_PROVIDER: 'fake', PAYMENTS_WEBHOOK_SECRET: 's' } as unknown as NodeJS.ProcessEnv)).toBe(false);
    expect(fakePaymentsAllowed({ ...on, E2E_AUTH_CONFIRM: undefined, VERCEL_ENV: 'development' })).toBe(true);
    expect(fakePaymentsAllowed({} as NodeJS.ProcessEnv)).toBe(false);
  });
  it('leaves checkout closed when no provider is set up', () => {
    expect(paymentsProvider({} as NodeJS.ProcessEnv)).toBeNull();
    expect(paymentsProvider({ ...on, VERCEL_ENV: 'production' })).toBeNull();
    expect(paymentsProvider(on)?.name).toBe('fake');
  });
});
