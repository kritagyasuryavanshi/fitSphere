import { expect, test } from '@playwright/test';
import { signInAs } from './helpers';

test.describe('save and complete', () => {
  test('a guest is asked to sign in first', async ({ page }) => {
    await page.goto('/learn/boxing/cross');
    await page.getByRole('link', { name: 'Log in to save and track this' }).click();
    await expect(page).toHaveURL(/\/sign-in/);
  });

  test('an athlete saves and completes a lesson, and both survive a reload', async ({ page }) => {
    await signInAs(page, ['athlete']);
    await page.goto('/learn/boxing/cross');
    await page.getByRole('button', { name: 'Mark complete' }).click();
    await expect(page.getByRole('button', { name: 'Completed ✓' })).toBeVisible();
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Saved' })).toHaveAttribute('aria-pressed', 'true');

    await page.reload();
    await expect(page.getByRole('button', { name: 'Completed ✓' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Saved' })).toBeVisible();

    await page.goto('/account/saved');
    const items = page.getByRole('list', { name: 'Saved items' }).getByRole('link');
    await expect(items).toHaveCount(1);
    await expect(items.first()).toContainText('The Cross');
    await expect(items.first()).toContainText('Completed');

    // Unsave from the lesson page; the Saved page empties.
    await page.goto('/learn/boxing/cross');
    await page.getByRole('button', { name: 'Saved' }).click();
    await expect(page.getByRole('button', { name: 'Save', exact: true })).toBeVisible();
    await page.goto('/account/saved');
    await expect(page.getByText('Nothing saved yet.')).toBeVisible();
  });
});
