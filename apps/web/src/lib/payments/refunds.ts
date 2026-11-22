import { createDbClient } from '@fitsphere/db';
import { processFakeRefund } from './fake-checkout';
import { paymentsProvider } from './provider';

/** A refund the database has recorded and the provider has not been sent yet (request_refund, refunds_to_send). */
export type RefundRow = { refund_id: string; provider_payment_id: string; amount_paise: number };
export type RefundDeps = {
  refund: (r: RefundRow) => Promise<{ id: string }>;
  attach: (refund: string, providerRefund: string) => Promise<void>;
};

/**
 * Sends each refund to the provider and records the provider's id. One failure does not stop the rest; a refund that
 * fails stays requested, and the daily cron sends it again. Returns how many were sent.
 */
export async function sendRefunds(rows: RefundRow[], deps: RefundDeps): Promise<number> {
  let sent = 0;
  for (const r of rows) {
    try {
      const { id } = await deps.refund(r);
      await deps.attach(r.refund_id, id);
      sent++;
    } catch (e) {
      console.error('sending a refund failed, the cron retries it', r.refund_id, e);
    }
  }
  return sent;
}

/** The real dependencies: the configured provider and the service database. Null when payments are not set up. */
function liveDeps(): RefundDeps | null {
  const provider = paymentsProvider();
  if (!provider || !process.env.SUPABASE_SECRET_KEY) return null;
  const db = createDbClient(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '', process.env.SUPABASE_SECRET_KEY);
  return {
    refund: async (r) => {
      const made = await provider.refund({ paymentId: r.provider_payment_id, amountPaise: r.amount_paise, refund: r.refund_id });
      // The fake has no provider to send the processed event, so it sends it here, through the real webhook, before
      // the attach: the event finds the refund by its payment. If it fails, nothing is attached and the cron retries.
      if (provider.name === 'fake') await processFakeRefund(r, made.id);
      return made;
    },
    attach: async (refund, providerRefund) => {
      const { error } = await db.rpc('attach_provider_refund', { refund, provider_refund: providerRefund });
      if (error) throw error;
    },
  };
}

/** Sends the refunds the athlete or an admin just asked for. Returns how many were sent, or null without payments. */
export async function sendRefundsNow(rows: RefundRow[]): Promise<number | null> {
  const deps = liveDeps();
  return deps ? sendRefunds(rows, deps) : null;
}

/**
 * The daily cron: a refund for every payment owed back, sent at once, then every requested refund not yet at the
 * provider and more than 10 minutes old. A younger one may still be on its way from the server. Returns how many were
 * sent.
 */
export async function sendPendingRefunds(): Promise<number | null> {
  const deps = liveDeps();
  if (!deps) return null;
  const db = createDbClient(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '', process.env.SUPABASE_SECRET_KEY ?? '');
  const queued = await db.rpc('queue_owed_back_refunds');
  if (queued.error) throw queued.error;
  const { data, error } = await db.rpc('refunds_to_send', { min_age_minutes: 10 });
  if (error) throw error;
  const fresh = new Set(queued.data.map((r) => r.refund_id));
  return sendRefunds([...queued.data, ...data.filter((r) => !fresh.has(r.refund_id))], deps);
}
