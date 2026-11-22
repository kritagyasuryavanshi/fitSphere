import { expect, test } from '@playwright/test';
import { admin, createUser, liveCoach, signInWithEmail } from './helpers';

const day = (offset: number) => new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);

test('a client reviews a finished month, the coach replies once, and the profile shows both', async ({ page }) => {
  const coach = await liveCoach('Leela', `Reviewpur ${Date.now()}`, 450000);
  const athlete = await createUser(['athlete'], { name: 'Kabir Singh' });
  const db = admin();
  // A month paid and finished, straight in the database: payments.spec.ts and renewals.spec.ts test paying.
  const { data: g, error } = await db
    .from('engagements')
    .insert({ athlete_id: athlete.id, coach_id: coach.id, package_title: 'Online coaching', package_kind: 'monthly', price_paise: 450000, fee_bps: 1500, start_date: day(-32), days_per_week: 3, status: 'ended', share_data: true, paid_through: day(-2) })
    .select('id')
    .single();
  expect(error).toBeNull();
  expect((await db.from('orders').insert({ engagement_id: g!.id, amount_paise: 450000, fee_bps: 1500, kind: 'first', period_start: day(-32), period_end: day(-2), status: 'paid', paid_at: new Date().toISOString() })).error).toBeNull();

  await signInWithEmail(page, athlete.email);
  await page.goto('/coaching');
  await page.getByRole('link', { name: 'Review Leela' }).click();
  const form = page.getByRole('form', { name: 'Review Leela' });
  await expect(form).toContainText('Verified client · Online coaching · 1 month');
  await form.getByRole('button', { name: 'Post review' }).click();
  // The browser asks for a rating first; the stars are radios.
  // The radios are visually hidden; a person clicks the star or the pill, which is the radio's label.
  await form.locator('label').filter({ has: page.getByRole('radio', { name: '5 stars' }) }).click();
  await expect(form.getByRole('radio', { name: '5 stars' })).toBeChecked();
  await form.getByRole('group', { name: 'Technique teaching' }).getByText('Excellent').click();
  await form.getByLabel('Your review').fill('He fixed my guard in the first week.');
  await form.getByRole('button', { name: 'Post review' }).click();

  await expect(page).toHaveURL(new RegExp(`/coaches/${coach.id}#reviews$`));
  const reviews = page.getByRole('region', { name: 'Reviews' });
  await expect(reviews).toContainText('5.0 (1 verified review)');
  await expect(reviews).toContainText('Kabir S.');
  await expect(reviews).toContainText('Verified client · Online coaching, 1 month');
  await expect(reviews).toContainText('He fixed my guard in the first week.');
  await expect(reviews).not.toContainText('Singh');
  await page.goto('/coaching');
  await expect(page.getByRole('link', { name: 'Review Leela' })).toHaveCount(0);

  // The coach replies once, in public.
  const { data: coachUser } = await db.auth.admin.getUserById(coach.id);
  await signInWithEmail(page, coachUser.user!.email!);
  await page.goto('/coach/clients');
  await page.getByRole('link', { name: 'Reviews' }).click();
  await expect(page.getByText('Kabir S.')).toBeVisible();
  await page.getByLabel('Reply in public').fill('Thank you, Kabir. Keep that guard up.');
  await page.getByRole('button', { name: 'Post reply' }).click();
  await expect(page.getByText('Your reply:')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Post reply' })).toHaveCount(0);
  await page.goto(`/coaches/${coach.id}`);
  await expect(page.getByRole('region', { name: 'Reviews' })).toContainText('Reply from Leela: Thank you, Kabir. Keep that guard up.');
});
