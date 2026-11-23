import { expect, test } from '@playwright/test';
import { admin, createUser, liveCoach, signInWithEmail } from './helpers';

test.skip(({ isMobile }) => isMobile, 'The admin queue is a desktop screen.');

// M4-18: an athlete reports a coach; an admin sees it in the queue and suspends the coach, which ends their coaching.
test('a reported coach is suspended from the admin queue', async ({ page }) => {
  const coach = await liveCoach(`Rakesh ${Date.now() % 10000}`, 'Delhi', 450000);
  const athlete = await createUser(['athlete'], { name: 'Neha' });
  const adminUser = await createUser(['admin'], { name: 'Asha' });

  await signInWithEmail(page, athlete.email);
  await page.goto(`/coaches/${coach.id}`);
  const box = page.locator('details').filter({ has: page.locator('summary', { hasText: 'Report this coach' }) });
  await box.locator('summary').click();
  await box.getByLabel('Why are you reporting this?').selectOption('unsafe_advice');
  await box.getByRole('button', { name: 'Send report' }).click();
  await expect(page.getByRole('status')).toContainText('Your report reached FitSphere');

  await signInWithEmail(page, adminUser.email);
  await page.goto('/admin/reports');
  const card = page.getByRole('article', { name: 'Report about a coach' }).filter({ hasText: 'Unsafe training advice' }).first();
  await expect(card).toBeVisible();
  await card.getByLabel('Reason for the suspension').fill('Unsafe advice to clients');
  await card.getByRole('button', { name: 'Suspend the coach' }).click();
  await expect(page.getByRole('status')).toContainText('Coach suspended.');

  const { data } = await admin().from('coach_profiles').select('status').eq('coach_id', coach.id).single();
  expect(data?.status).toBe('suspended');
});
