import { createHmac, timingSafeEqual } from 'node:crypto';

/** HMAC-SHA256 of the raw body, as hex: the X-Razorpay-Signature scheme. The fake provider signs the same way. */
export function signBody(body: string, secret: string): string {
  return createHmac('sha256', secret).update(body).digest('hex');
}

/** True only for the exact signature of this body. Constant time, so the comparison leaks nothing. */
export function verifySignature(body: string, signature: string | null, secret: string | undefined): boolean {
  if (!signature || !secret) return false;
  const expected = Buffer.from(signBody(body, secret), 'utf8');
  const given = Buffer.from(signature, 'utf8');
  return expected.length === given.length && timingSafeEqual(expected, given);
}
