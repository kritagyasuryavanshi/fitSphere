import { expect, test } from '@playwright/test';

test.describe('search', () => {
  test('jab finds the jab lesson first, its drills, and filters by type', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: 'Search lessons and drills' }).first().click();
    await page.getByRole('searchbox', { name: /Search lessons/ }).fill('jab');
    await page.getByRole('button', { name: 'Search' }).click();
    await expect(page).toHaveURL(/\/search\?q=jab/);

    const results = page.getByRole('list', { name: 'Results' }).getByRole('link');
    await expect(results.first()).toContainText('The Jab');
    await expect(results.first()).toContainText('Skill lesson');

    await page.getByRole('link', { name: /^Drills \d+/ }).click();
    await expect(page).toHaveURL(/type=drill/);
    await expect(results.filter({ visible: true }).first()).toContainText('Drill');
    await expect(results.filter({ visible: true }).filter({ hasText: 'Skill lesson' })).toHaveCount(0);
  });

  test('no match says so', async ({ page }) => {
    await page.goto('/search?q=zzzqqq');
    await expect(page.getByRole('status')).toHaveText('0 results for “zzzqqq”');
  });
});
