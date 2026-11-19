import { expect, test } from '@playwright/test';
import { liveCoach, signInAs } from './helpers';

test('an athlete shortlists two coaches, then compares them', async ({ page }) => {
  const city = `Comparepur ${Date.now()}`;
  await liveCoach('Farah', city, 400000);
  await liveCoach('Gautam', city, 700000);
  await liveCoach('Hema', city, 500000);

  // A guest is asked to sign in first.
  await page.goto(`/coaches?city=${encodeURIComponent(city)}`);
  await expect(page.getByRole('link', { name: 'Shortlist Farah' })).toHaveAttribute('href', '/sign-in');

  await signInAs(page, ['athlete'], { name: 'Kabir' });
  await page.goto(`/coaches?city=${encodeURIComponent(city)}`);
  const results = page.getByRole('region', { name: 'Coaches' });
  await results.getByRole('button', { name: 'Shortlist Farah' }).click();
  await expect(results.getByRole('button', { name: 'Shortlisted Farah' })).toHaveAttribute('aria-pressed', 'true');
  await results.getByRole('button', { name: 'Shortlist Gautam' }).click();
  await expect(results.getByRole('button', { name: 'Shortlisted Gautam' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Your shortlist (2)' })).toBeVisible();

  await page.getByRole('link', { name: 'Your shortlist (2)' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Shortlist' })).toBeVisible();
  await expect(page.getByText('Only you see your shortlist. Coaches are not told.')).toBeVisible();
  await page.getByLabel('Compare Farah').check();
  await page.getByLabel('Compare Gautam').check();
  await page.getByRole('button', { name: 'Compare selected' }).click();

  const table = page.getByRole('table', { name: 'Coaches compared' });
  await expect(table.getByRole('columnheader')).toHaveText(['Detail', 'Farah', 'Gautam']);
  await expect(table.getByRole('row', { name: /Online coaching/ })).toContainText('₹4,000 / month');
  await expect(table.getByRole('row', { name: /Online coaching/ })).toContainText('₹7,000 / month');
  await expect(table.getByRole('row', { name: /Credentials/ }).first()).toContainText('Credentials self-reported');

  // Removing a coach takes them off the shortlist.
  await page.goto('/shortlist');
  await page.getByRole('region', { name: 'Remove from shortlist' }).getByRole('button', { name: 'Shortlisted Farah' }).click();
  await expect(page.getByLabel('Compare Farah')).toHaveCount(0);
  await expect(page.getByLabel('Compare Gautam')).toBeVisible();
});
