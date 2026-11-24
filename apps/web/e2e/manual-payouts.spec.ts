import { expect, test } from '@playwright/test';
import { admin, createUser, liveCoach, signInWithEmail } from './helpers';

test.skip(({ isMobile }) => isMobile, 'An admin screen; desktop is enough.');

// M4-13 phase a: an admin pays a ready payout by bank transfer and records it; the coach sees it as paid.
test('an admin records a payout, and the coach sees it in Earnings', async ({ page }) => {
  const coach = await liveCoach('Rohan', 'Pune', 450000);
  const athlete = await createUser(['athlete'], { name: 'Kabir' });
  const adminUser = await createUser(['admin'], { name: 'Asha' });
  const db = admin();
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
  const ok = ({ error }: { error: unknown }) => expect(error).toBeNull();
  // A paid month whose hold has ended, straight in the database: paying has its own tests.
  const { data: g } = await db
    .from('engagements')
    .insert({ athlete_id: athlete.id, coach_id: coach.id, package_title: 'Monthly', package_kind: 'monthly', price_paise: 450000, fee_bps: 1500,
      start_date: today, days_per_week: 3, status: 'active', share_data: true, paid_through: today })
    .select('id')
    .single();
  const stamp = Date.now();
  const { data: o } = await db
    .from('orders')
    .insert({ engagement_id: g!.id, amount_paise: 450000, fee_bps: 1500, kind: 'first', period_start: today, period_end: today, provider_order_id: `order_e2e_${stamp}`, status: 'paid', paid_at: new Date().toISOString() })
    .select('id')
    .single();
  const { data: p } = await db
    .from('payments')
    .insert({ order_id: o!.id, provider_payment_id: `pay_e2e_${stamp}`, amount_paise: 450000, currency: 'INR', status: 'captured', captured_at: new Date().toISOString() })
    .select('id')
    .single();
  ok(await db.from('payouts').insert({ payment_id: p!.id, coach_id: coach.id, gross_paise: 450000, fee_paise: 67500, net_paise: 382500, hold_until: new Date(Date.now() - 86_400_000).toISOString() }));

  await signInWithEmail(page, adminUser.email);
  await page.goto('/admin/payouts');
  const card = page.getByRole('article', { name: 'Payout to Rohan' });
  await expect(card).toContainText('₹3,825');
  await card.getByLabel('Bank reference (UTR)').fill(`UTR${stamp}`);
  await card.getByRole('button', { name: 'Mark paid' }).click();
  await expect(page.getByRole('status')).toHaveText('Recorded as paid.');
  await expect(page.getByRole('article', { name: 'Payout to Rohan' })).toHaveCount(0);

  await signInWithEmail(page, coach.email);
  await page.goto('/coach/earnings');
  await expect(page.getByText('Paid', { exact: true }).locator('..')).toContainText('₹3,825');
  await expect(page.getByText(/^Estimated\./)).toBeVisible();
});
