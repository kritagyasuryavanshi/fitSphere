import { expect, test } from '@playwright/test';
import { admin, createUser, liveCoach, signInWithEmail } from './helpers';

// M4-15: a coach writes a story about a paying client; it shows on the public profile only after the client
// approves those exact words, and disappears when the client withdraws.
test('a story shows only after the client approves it, and goes when they withdraw', async ({ page }) => {
  const coach = await liveCoach('Vikram', 'Mumbai', 450000);
  const athlete = await createUser(['athlete'], { name: 'Kabir' });
  const db = admin();
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
  const { data: g, error } = await db
    .from('engagements')
    .insert({ athlete_id: athlete.id, coach_id: coach.id, package_title: 'Monthly', package_kind: 'monthly', price_paise: 450000, fee_bps: 1500,
      start_date: today, days_per_week: 3, status: 'active', share_data: true, paid_through: today })
    .select('id')
    .single();
  expect(error).toBeNull();
  expect((await db.from('orders').insert({ engagement_id: g!.id, amount_paise: 450000, fee_bps: 1500, kind: 'first', period_start: today, period_end: today,
    provider_order_id: `order_story_${Date.now()}`, status: 'paid', paid_at: new Date().toISOString() })).error).toBeNull();
  const words = `Kabir turned up three times a week and now throws a clean jab-cross. ${Date.now()}`;

  await signInWithEmail(page, coach.email);
  await page.goto(`/coach/clients/${g!.id}/story`);
  await page.getByLabel('The story').fill(words);
  await page.getByRole('button', { name: 'Save and send to the client' }).click();
  await expect(page.getByRole('status')).toContainText('Saved.');
  await page.goto(`/coaches/${coach.id}`);
  await expect(page.getByRole('region', { name: 'Client stories' })).toHaveCount(0);

  await signInWithEmail(page, athlete.email);
  await page.goto('/coaching');
  await page.getByRole('link', { name: /Read the story .* wrote about you/ }).click();
  await expect(page.getByText(words)).toBeVisible();
  await page.getByRole('button', { name: 'Approve these words' }).click();
  await expect(page.getByRole('status')).toContainText('Approved.');

  await page.goto(`/coaches/${coach.id}`);
  const stories = page.getByRole('region', { name: 'Client stories' });
  await expect(stories).toContainText(words);
  await expect(stories).toContainText('Kabir');

  await page.goto(`/coaching/${g!.id}/story`);
  await page.getByRole('button', { name: 'Withdraw my approval' }).click();
  await expect(page.getByRole('status')).toContainText('Withdrawn.');
  await page.goto(`/coaches/${coach.id}`);
  await expect(page.getByRole('region', { name: 'Client stories' })).toHaveCount(0);
});
