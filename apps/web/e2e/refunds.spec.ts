import { expect, test } from '@playwright/test';
import { admin, liveCoach, signInAs } from './helpers';

test('a new monthly client asks for a refund within 7 days: the coaching ends and the payout is reversed', async ({ page }) => {
  const coach = await liveCoach('Leela', `Refundpur ${Date.now()}`, 450000);
  await signInAs(page, ['athlete'], { name: 'Kabir' });
  await page.goto(`/hire/${coach.id}`);
  await page.getByRole('form', { name: 'Hire Leela' }).getByRole('button', { name: 'Send request' }).click();
  await expect(page).toHaveURL('/coaching');
  // The coach accepts (hire.spec.ts tests that flow); the athlete pays with the fake provider (payments.spec.ts).
  expect((await admin().from('engagements').update({ status: 'accepted', decided_at: new Date().toISOString() }).eq('coach_id', coach.id)).error).toBeNull();
  await page.reload();
  await page.getByRole('link', { name: 'Pay ₹4,500' }).click();
  await page.getByRole('button', { name: 'Pay ₹4,500' }).click();
  await expect(page.getByRole('status')).toContainText('Payment received');

  await page.goto('/coaching');
  await page.getByRole('link', { name: 'Ask for a refund' }).click();
  const dialog = page.getByRole('alertdialog', { name: 'Ask for a refund?' });
  await expect(dialog).toContainText('We refund ₹4,500 in full');
  await expect(dialog).toContainText('Refunds are for a first payment, within 7 days.');
  await dialog.getByRole('button', { name: 'Refund ₹4,500' }).click();
  await expect(page).toHaveURL('/coaching');
  await expect(page.getByText('Refunded', { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Ask for a refund' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Cancel coaching' })).toHaveCount(0);

  // The database agrees: refunded once, the payout reversed, the subscription stopped, both people emailed.
  const db = admin();
  const { data: g } = await db.from('engagements').select('id, status').eq('coach_id', coach.id).single();
  expect(g!.status).toBe('refunded');
  const { data: orders } = await db.from('orders').select('status, payments(status, payouts(status), refunds(status, reason))').eq('engagement_id', g!.id);
  expect(orders).toEqual([{ status: 'refunded', payments: [{ status: 'refunded', payouts: { status: 'reversed' }, refunds: [{ status: 'processed', reason: 'first_payment' }] }] }]);
  const { data: sub } = await db.from('subscriptions').select('status').eq('engagement_id', g!.id).single();
  expect(sub!.status).toBe('cancelled');
  const { count } = await db.from('email_outbox').select('id', { count: 'exact', head: true }).eq('template', 'coaching_refunded').eq('data->>engagement', g!.id);
  expect(count).toBe(2);
  // A refund link from an old tab now leads nowhere (a soft 404 under Suspense, lesson-next16-suspense).
  await page.goto(`/coaching/${g!.id}/refund`);
  await expect(page.getByRole('heading', { name: 'Page not found.' })).toBeVisible();
});
