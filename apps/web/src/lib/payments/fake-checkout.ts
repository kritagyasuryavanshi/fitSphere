import { createDbClient } from '@fitsphere/db';
import { fakePaymentsAllowed } from './provider';
import { signBody } from './signature';
import { handleWebhook } from './webhook';

/**
 * The fake provider's checkout: "captures" an open order by sending the signed webhook Razorpay would, through the real
 * webhook handler, so the same one writer of money state applies it. Called only from the athlete's checkout action,
 * after it checked them. Returns the order's engagement, or null.
 */
export async function captureFakeOrder(order: string): Promise<string | null> {
  if (!fakePaymentsAllowed()) return null;
  const db = createDbClient(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '', process.env.SUPABASE_SECRET_KEY ?? '');
  const { data: o, error } = await db.from('orders').select('engagement_id, amount_paise, currency, provider_order_id').eq('id', order).maybeSingle();
  if (error) throw error;
  if (!o?.provider_order_id) return null;
  const id = order.replace(/-/g, '');
  const body = JSON.stringify({
    event: 'payment.captured',
    payload: { payment: { entity: { id: `fake_pay_${id}`, order_id: o.provider_order_id, amount: o.amount_paise, currency: o.currency, status: 'captured' } } },
  });
  const res = await handleWebhook(body, signBody(body, process.env.PAYMENTS_WEBHOOK_SECRET!), `fake_evt_${id}`);
  if (!res.ok) throw new Error(`fake capture failed: ${res.status}`);
  return o.engagement_id;
}
