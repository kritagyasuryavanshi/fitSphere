import { redirect } from 'next/navigation';
import { connection } from 'next/server';
import { captureFakeOrder } from '@/lib/payments/fake-checkout';
import { fakePaymentsAllowed } from '@/lib/payments/provider';
import { isUuid } from '@/lib/programs';

// Test only: captures an open order with the fake provider, for tests that drive payment directly.
// Not found unless PAYMENTS_PROVIDER=fake outside production.
export async function GET(request: Request) {
  await connection();
  if (!fakePaymentsAllowed()) return new Response('Not found', { status: 404 });
  const order = new URL(request.url).searchParams.get('order') ?? '';
  if (!isUuid(order)) return new Response('Not found', { status: 404 });
  const engagement = await captureFakeOrder(order);
  if (!engagement) return new Response('Not found', { status: 404 });
  redirect(`/coaching/${engagement}/pay`);
}
