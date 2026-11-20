import { connection } from 'next/server';
import { handleWebhook } from '@/lib/payments/webhook';

// The provider's signed webhook. Exempt from the route guards: the signature is the authentication.
export async function POST(request: Request) {
  await connection();
  // The raw text, before any parsing: the signature covers these exact bytes.
  const raw = await request.text();
  return handleWebhook(raw, request.headers.get('x-razorpay-signature'), request.headers.get('x-razorpay-event-id'));
}
