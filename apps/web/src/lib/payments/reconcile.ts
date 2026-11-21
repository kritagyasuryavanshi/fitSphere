import { createDbClient } from '@fitsphere/db';
import { paymentsProvider } from './provider';

/**
 * Cancels at the provider every subscription still renewing although its coaching stopped (cancelled, ended, lapsed,
 * or the athlete's account deleted), then marks it cancelled. Runs daily after the sweep, so it also retries a cancel
 * that failed when the athlete cancelled. One failure does not stop the rest. Returns how many it stopped.
 */
export async function stopSubscriptions() {
  const provider = paymentsProvider();
  if (!provider || !process.env.SUPABASE_SECRET_KEY) return null;
  const db = createDbClient(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '', process.env.SUPABASE_SECRET_KEY);
  const { data, error } = await db.rpc('subscriptions_to_stop');
  if (error) throw error;
  let stopped = 0;
  for (const s of data) {
    try {
      await provider.cancelSubscription(s.provider_subscription_id);
      const marked = await db.rpc('mark_subscription_cancelled', { subscription: s.subscription_id });
      if (marked.error) throw marked.error;
      stopped++;
    } catch (e) {
      console.error('stopping a subscription failed, will retry tomorrow', s.subscription_id, e);
    }
  }
  return stopped;
}
