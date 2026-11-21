import { randomUUID } from 'node:crypto';

/** What checkout needs from a payment provider. Razorpay joins in M4-09b; until then only the fake exists. */
export type Provider = {
  name: 'fake' | 'razorpay';
  createOrder(input: { amountPaise: number; receipt: string }): Promise<{ id: string }>;
  /** A monthly subscription that renews the coaching (M4-11). */
  createSubscription(input: { engagement: string; amountPaise: number }): Promise<{ id: string }>;
  /** Stops future renewals; the paid month runs on. */
  cancelSubscription(id: string): Promise<void>;
  webhookSecret: string;
};

/**
 * The fake provider runs only with PAYMENTS_PROVIDER=fake, a webhook secret, and a positive sign that this is not
 * production: a Vercel preview or development deployment, or the test-only E2E_AUTH_CONFIRM server. Anything else,
 * a self-hosted production server included, stays closed. NODE_ENV cannot tell: it is "production" under
 * `next start` in CI too. The database refuses fake orders as well unless its own setting allows them.
 */
export function fakePaymentsAllowed(env: NodeJS.ProcessEnv = process.env): boolean {
  const notProduction = env.VERCEL_ENV === 'preview' || env.VERCEL_ENV === 'development' || (!env.VERCEL_ENV && env.E2E_AUTH_CONFIRM === '1');
  return env.PAYMENTS_PROVIDER === 'fake' && !!env.PAYMENTS_WEBHOOK_SECRET && notProduction;
}

/** The configured provider, or null when checkout is not open (production until Razorpay keys exist). */
export function paymentsProvider(env: NodeJS.ProcessEnv = process.env): Provider | null {
  if (fakePaymentsAllowed(env)) {
    return {
      name: 'fake',
      webhookSecret: env.PAYMENTS_WEBHOOK_SECRET!,
      createOrder: async () => ({ id: `fake_order_${randomUUID().replace(/-/g, '')}` }),
      // shortcut: the fake opens and cancels subscriptions without renewing anything; tests send its events directly.
      createSubscription: async () => ({ id: `fake_sub_${randomUUID().replace(/-/g, '')}` }),
      cancelSubscription: async () => {},
    };
  }
  // shortcut: Razorpay Orders arrive with M4-09b, once the owner's test keys exist (owner item O-04).
  return null;
}
