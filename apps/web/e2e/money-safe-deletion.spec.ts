import { expect, test } from '@playwright/test';
import { admin, createUser, liveCoach, signInWithEmail } from './helpers';

test('an athlete whose coaching still renews is asked to cancel it before deleting their account', async ({ page }) => {
  const coach = await liveCoach('Leela', `Delpur ${Date.now()}`, 450000);
  const athlete = await createUser(['athlete'], { name: 'Kabir' });
  const db = admin();
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
  // Renewing coaching straight in the database: paying and renewing have their own tests (renewals.spec.ts).
  const { data: g, error } = await db
    .from('engagements')
    .insert({ athlete_id: athlete.id, coach_id: coach.id, package_title: 'Monthly', package_kind: 'monthly', price_paise: 450000, fee_bps: 1500, start_date: today, days_per_week: 3, status: 'active', paid_through: today })
    .select('id')
    .single();
  expect(error).toBeNull();
  expect((await db.from('subscriptions').insert({ engagement_id: g!.id, provider_subscription_id: `sub_e2e_${Date.now()}` })).error).toBeNull();

  await signInWithEmail(page, athlete.email);
  await page.goto('/account/delete');
  await page.getByRole('button', { name: 'Delete my account' }).click();
  await expect(page).toHaveURL('/account/delete?error=coaching');
  const alert = page.getByRole('alert').filter({ hasText: 'Your coaching still renews each month.' });
  await expect(alert).toBeVisible();
  await expect(alert.getByRole('link', { name: 'Your coaching' })).toHaveAttribute('href', '/coaching');
  // Nothing was removed: the account is still there.
  expect((await db.from('profiles').select('id').eq('id', athlete.id).single()).data).not.toBeNull();
});
