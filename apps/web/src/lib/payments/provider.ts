import { randomUUID } from 'node:crypto';

/** What checkout needs from a payment provider. Razorpay joins in M4-09b; until then only the fake exists. */
export type Provider = {
  name: 'fake' | 'razorpay';
  createOrder(input: { amountPaise: number; receipt: string }): Promise<{ id: string }>;
  webhookSecret: string;
};

/**
 * The fake provider runs only when PAYMENTS_PROVIDER=fake and the deployment is not production, so a test-mode
 * shortcut can never take or fake money on the live site. NODE_ENV is "production" under `next start` in CI too,
 * so the guard reads Vercel's environment instead.
 */
export function fakePaymentsAllowed(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.PAYMENTS_PROVIDER === 'fake' && env.VERCEL_ENV !== 'production' && !!env.PAYMENTS_WEBHOOK_SECRET;
}

/** The configured provider, or null when checkout is not open (production until Razorpay keys exist). */
export function paymentsProvider(env: NodeJS.ProcessEnv = process.env): Provider | null {
  if (fakePaymentsAllowed(env)) {
    return {
      name: 'fake',
      webhookSecret: env.PAYMENTS_WEBHOOK_SECRET!,
      createOrder: async () => ({ id: `fake_order_${randomUUID().replace(/-/g, '')}` }),
    };
  }
  // shortcut: Razorpay Orders arrive with M4-09b, once the owner's test keys exist (owner item O-04).
  return null;
}
