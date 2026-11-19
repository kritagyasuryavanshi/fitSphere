import { expect, test } from '@playwright/test';
import { liveCoach } from './helpers';

test.describe('Find a coach', () => {
  test('the price filter shows only coaches in range', async ({ page }) => {
    // A city of its own, so coaches from other tests do not count.
    const city = `Testpur ${Date.now()}`;
    await liveCoach('Meera', city, 300000);
    await liveCoach('Kunal', city, 500000);
    await liveCoach('Tara', city, 900000);

    await page.goto('/coaches');
    await expect(page.getByRole('heading', { level: 1, name: 'Find a coach' })).toBeVisible();
    await page.getByLabel('City').selectOption(city);
    const results = page.getByRole('region', { name: 'Coaches' });
    await expect(results.getByText('3 coaches')).toBeVisible();

    await page.getByLabel('Min ₹').fill('4,000');
    await page.getByLabel('Max ₹').fill('6000');
    await page.getByRole('button', { name: 'Show results' }).click();
    await expect(results.getByText('1 coach', { exact: true })).toBeVisible();
    await expect(results.getByRole('link', { name: 'Kunal', exact: true })).toBeVisible();
    await expect(results.getByText('From ₹5,000/month')).toBeVisible();
    await expect(results.getByRole('link', { name: 'Meera', exact: true })).toHaveCount(0);
    await expect(results.getByRole('link', { name: 'Tara', exact: true })).toHaveCount(0);

    // Price sort, low to high, with the range cleared.
    await page.goto(`/coaches?city=${encodeURIComponent(city)}&sort=price`);
    await expect(results.locator('a[href^="/coaches/"]')).toHaveText(['Meera', 'Kunal', 'Tara']);

    // A card opens the coach's public profile.
    await results.getByRole('link', { name: 'Kunal', exact: true }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Kunal' })).toBeVisible();
  });
});
