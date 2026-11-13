import { expect, type Page, test } from '@playwright/test';

// Desktop shows a filter column; a phone folds the filters into a panel, opened here.
async function filterBox(page: Page) {
  const toggle = page.locator('summary', { hasText: 'Filters' });
  if (await toggle.isVisible()) {
    const panel = page.locator('details');
    // A click right after load can land before the page settles, so retry until the panel is open.
    await expect(async () => {
      if ((await panel.getAttribute('open')) === null) await toggle.click();
      await expect(panel).toHaveAttribute('open', '', { timeout: 1000 });
    }).toPass();
    return panel;
  }
  return page.getByRole('complementary', { name: 'Filters' });
}

test.describe('library', () => {
  test('filtering boxing drills by equipment shows only matching items, and the URL keeps it', async ({ page }) => {
    await page.goto('/learn/boxing');
    await expect(page.getByRole('heading', { level: 1, name: 'Boxing' })).toBeVisible();
    const tiles = page.getByRole('region', { name: 'Boxing lessons' }).locator('a[href^="/learn/boxing/"]');
    await expect(tiles.filter({ hasText: /^The Jab/ })).toHaveCount(1);
    await expect(page.getByText(/^\d+ lessons shown$/)).toBeVisible();

    await (await filterBox(page)).getByRole('checkbox', { name: /Heavy bag/ }).check();
    await expect(page).toHaveURL(/equipment=heavy_bag/);
    await expect(tiles).toHaveCount(1);
    await expect(tiles.first()).toContainText('Heavy bag rhythm');
    await expect(page.getByText('1 lesson shown')).toBeVisible();

    // Reload and share keep the filter.
    await page.reload();
    await expect(tiles).toHaveCount(1);
    await expect((await filterBox(page)).getByRole('checkbox', { name: /Heavy bag/ })).toBeChecked();

    await page.getByRole('link', { name: /Heavy bag.*Remove filter/ }).click();
    await expect(page).toHaveURL(/\/learn\/boxing$/);
    await expect(tiles.filter({ hasText: /^The Jab/ })).toHaveCount(1);
  });

  test('samples say Sample, never Coach-verified', async ({ page }) => {
    await page.goto('/learn/sc');
    await expect(page.getByRole('heading', { level: 1, name: 'Strength & Conditioning' })).toBeVisible();
    await expect(page.getByText('Sample, awaiting a coach').first()).toBeVisible();
    await expect(page.getByText('Coach-verified')).toHaveCount(0);
  });

  test('the gym library filters by muscle group and where you train', async ({ page }) => {
    await page.goto('/learn/gym?discipline=chest&environments=bodyweight');
    const tiles = page.getByRole('region', { name: 'Gym & Fitness exercises' }).locator('a[href^="/learn/gym/"]');
    await expect(tiles).toHaveCount(1);
    await expect(tiles.first()).toContainText('Push-up');
    await expect((await filterBox(page)).getByRole('group', { name: 'Muscle group' })).toBeVisible();
  });

  test('a category that is not live, or does not exist, is not found', async ({ page }) => {
    // notFound() inside Suspense streams a soft 404: the not-found page with noindex, status 200.
    for (const path of ['/learn/cricket', '/learn/nope']) {
      await page.goto(path);
      await expect(page.getByRole('heading', { name: 'This page could not be found.' })).toBeVisible();
    }
  });
});
