import { createDbClient } from '@fitsphere/db';
import { paymentsProvider } from './provider';
import { verifySignature } from './signature';

/**
 * Handles one provider webhook: verify the signature on the raw body, then hand the event to apply_payment_event,
 * the one writer of money state. 200 for applied, duplicate or ignored; 401 for a bad signature; 500 only on a
 * database error, so the provider retries.
 */
export async function handleWebhook(rawBody: string, signature: string | null, eventIdHeader: string | null): Promise<Response> {
  const provider = paymentsProvider();
  if (!provider || !process.env.SUPABASE_SECRET_KEY) return new Response('Payments are not set up', { status: 404 });
  if (!verifySignature(rawBody, signature, provider.webhookSecret)) return new Response('Bad signature', { status: 401 });

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    return new Response('Bad body', { status: 400 });
  }
  // A signed `null` or array is not an event: refuse it, so the provider does not retry it forever.
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return new Response('Bad body', { status: 400 });
  const body = parsed as { event?: unknown; id?: unknown };
  const type = typeof body.event === 'string' ? body.event : '';
  // Unverified for Razorpay (docs/plans/m4-plan.md): the event id comes from x-razorpay-event-id.
  const eventId = eventIdHeader ?? (typeof body.id === 'string' ? body.id : '');
  if (!type || !eventId) return new Response('Missing event', { status: 400 });

  const db = createDbClient(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '', process.env.SUPABASE_SECRET_KEY);
  const { data, error } = await db.rpc('apply_payment_event', { event_id: eventId, event_type: type, body: body as never });
  if (error) {
    console.error('apply_payment_event failed', error.code, error.message);
    return new Response('Try again', { status: 500 });
  }
  return Response.json({ result: data });
}
