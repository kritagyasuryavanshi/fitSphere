import { describe, expect, it } from 'vitest';
import { fakePaymentsAllowed, paymentsProvider } from './provider';
import { sendRefunds } from './refunds';
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
  it('opens a fake subscription and cancels it without a network call', async () => {
    const provider = paymentsProvider(on)!;
    const sub = await provider.createSubscription({ engagement: 'e1', amountPaise: 450000 });
    expect(sub.id).toMatch(/^fake_sub_[0-9a-f]{32}$/);
    await expect(provider.cancelSubscription(sub.id)).resolves.toBeUndefined();
  });
});

describe('refunds (M4-12)', () => {
  const on = { PAYMENTS_PROVIDER: 'fake', PAYMENTS_WEBHOOK_SECRET: 's', E2E_AUTH_CONFIRM: '1' } as unknown as NodeJS.ProcessEnv;
  const row = (n: number) => ({ refund_id: `0000000${n}-0000-0000-0000-000000000000`, provider_payment_id: `pay_${n}`, amount_paise: 450000 });

  it('the fake gives one refund id per refund, so a retry is never a second refund', async () => {
    const provider = paymentsProvider(on)!;
    const a = await provider.refund({ paymentId: 'pay_1', amountPaise: 450000, refund: row(1).refund_id });
    const b = await provider.refund({ paymentId: 'pay_1', amountPaise: 450000, refund: row(1).refund_id });
    expect(a.id).toMatch(/^fake_rfnd_[0-9a-f]{32}$/);
    expect(b.id).toBe(a.id);
  });

  it('sends each refund and attaches the provider id; one failure does not stop the rest', async () => {
    const attached: string[][] = [];
    const sent = await sendRefunds([row(1), row(2), row(3)], {
      refund: async (r) => {
        if (r.provider_payment_id === 'pay_2') throw new Error('provider down');
        return { id: `rfnd_${r.provider_payment_id}` };
      },
      attach: async (refund, providerRefund) => {
        attached.push([refund, providerRefund]);
      },
    });
    expect(sent).toBe(2);
    expect(attached).toEqual([
      [row(1).refund_id, 'rfnd_pay_1'],
      [row(3).refund_id, 'rfnd_pay_3'],
    ]);
  });
});
