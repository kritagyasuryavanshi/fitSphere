import { expect, test } from '@playwright/test';
import { admin, liveCoach, signInAs } from './helpers';

test('an athlete pays for accepted coaching with the fake provider, and coaching becomes active', async ({ page }) => {
  const coach = await liveCoach('Leela', `Paypur ${Date.now()}`, 450000);
  await signInAs(page, ['athlete'], { name: 'Kabir' });
  await page.goto(`/hire/${coach.id}`);
  await page.getByRole('form', { name: 'Hire Leela' }).getByRole('button', { name: 'Send request' }).click();
  await expect(page).toHaveURL('/coaching');
  // The coach accepts (the accept flow has its own test, hire.spec.ts).
  expect((await admin().from('engagements').update({ status: 'accepted', decided_at: new Date().toISOString() }).eq('coach_id', coach.id)).error).toBeNull();

  await page.reload();
  await page.getByRole('link', { name: 'Pay ₹4,500' }).click();
  await expect(page.getByText('Test mode: no real money moves.')).toBeVisible();
  await page.getByRole('button', { name: 'Pay ₹4,500' }).click();
  await expect(page.getByRole('status')).toContainText('Payment received. Coaching starts');

  // The database agrees: the order is paid, and the coach's payout is the price less the 15% fee.
  const { data: g } = await admin().from('engagements').select('id, status').eq('coach_id', coach.id).single();
  expect(g!.status).toBe('active');
  const { data: payout } = await admin().from('payouts').select('gross_paise, fee_paise, net_paise').eq('coach_id', coach.id).single();
  expect(payout).toEqual({ gross_paise: 450000, fee_paise: 67500, net_paise: 382500 });
  await page.goto('/coaching');
  await expect(page.getByText('Active', { exact: true })).toBeVisible();
});

test('the payment webhook refuses a request without a valid signature', async ({ request }) => {
  const res = await request.post('/api/payments/webhook', {
    data: '{"event":"payment.captured"}',
    headers: { 'content-type': 'application/json', 'x-razorpay-signature': 'not-a-signature', 'x-razorpay-event-id': 'evt_forged' },
  });
  expect(res.status()).toBe(401);
});
