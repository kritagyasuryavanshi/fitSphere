import { expect, test } from '@playwright/test';
import { admin, createUser, liveCoach, signInWithEmail } from './helpers';

// Decision 1 (docs/plans/remaining-tasks-plan.md): monthly coaching without a subscription renews when the athlete
// pays the next month, from 5 days before the paid date. The fake provider pays through the signed webhook.
test('an athlete pays the next month, and the paid date moves a month on', async ({ page }) => {
  const coach = await liveCoach('Vikram', 'Mumbai', 450000);
  const athlete = await createUser(['athlete'], { name: 'Kabir' });
  const db = admin();
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
  const inTwoDays = new Date(Date.parse(`${today}T00:00:00Z`) + 2 * 86_400_000).toISOString().slice(0, 10);
  const { data: g, error } = await db
    .from('engagements')
    .insert({ athlete_id: athlete.id, coach_id: coach.id, package_title: 'Monthly', package_kind: 'monthly', price_paise: 450000, fee_bps: 1500,
      start_date: today, days_per_week: 3, status: 'active', share_data: true, paid_through: inTwoDays })
    .select('id')
    .single();
  expect(error).toBeNull();

  await signInWithEmail(page, athlete.email);
  await page.goto(`/coaching/${g!.id}/pay`);
  const next = page.getByRole('region', { name: 'Your next month' });
  await expect(next).toContainText(`Your coaching runs until ${inTwoDays}.`);
  await next.getByRole('button', { name: 'Pay ₹4,500 for the next month' }).click();
  await expect(page.getByText('Confirming your payment for the next month.')).toBeVisible();

  await expect
    .poll(async () => (await db.from('engagements').select('paid_through').eq('id', g!.id).single()).data?.paid_through, { timeout: 10_000 })
    .not.toBe(inTwoDays);
  const { data: orders } = await db.from('orders').select('kind, status, period_start').eq('engagement_id', g!.id);
  expect(orders).toEqual([{ kind: 'renewal', status: 'paid', period_start: new Date(Date.parse(`${inTwoDays}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10) }]);
});
