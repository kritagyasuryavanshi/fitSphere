import { expect, test } from '@playwright/test';
import { signInAs } from './helpers';

test.describe('coach lesson editor', () => {
  test('a coach drafts a lesson, saves it, then submits it for review', async ({ page }) => {
    await signInAs(page, ['athlete', 'coach'], { name: 'Vikram' });
    await page.goto('/coach/lessons');
    await expect(page.getByText('No lessons yet')).toBeVisible();
    await page.getByRole('link', { name: 'New lesson' }).click();

    const submit = page.getByRole('button', { name: 'Submit for review' });
    await page.getByLabel('Lesson title').fill('The double jab');
    await page.getByLabel('Sport and discipline').selectOption({ label: 'Boxing · Combinations' });
    await page.getByLabel('YouTube video link').fill('not a link');
    await expect(page.getByText('This is not a YouTube link.')).toBeVisible();
    await page.getByLabel('YouTube video link').fill('https://youtu.be/dQw4w9WgXcQ');
    await expect(page.getByText('Video found')).toBeVisible();
    await page.getByLabel('Step 1').fill('Throw a jab to find the range.');
    await page.getByLabel('Step 2').fill('Throw a second jab at once.');
    await expect(submit).toBeDisabled();
    await page.getByLabel('Step 3').fill('Return the hand to the guard.');
    await page.getByLabel('Common mistakes').fill('Pulling the first jab short.');
    await expect(page.getByText('Add at least one safety point before you submit.')).toBeVisible();
    await expect(submit).toBeDisabled();

    // Save the draft first; it comes back after a reload.
    await page.getByRole('button', { name: 'Save draft' }).click();
    await expect(page.getByText('Draft saved')).toBeVisible();
    await page.reload();
    await expect(page.getByLabel('Step 3')).toHaveValue('Return the hand to the guard.');

    await page.getByLabel('Safety').fill('Keep the rear hand at the chin.');
    await expect(submit).toBeEnabled();
    await submit.click();
    await expect(page).toHaveURL(/\/coach\/lessons\?submitted=1/);
    const row = page.getByRole('list', { name: 'Lessons' }).getByRole('listitem').filter({ hasText: 'The double jab' });
    await expect(row.getByText('In review')).toBeVisible();
  });

  test('an athlete without the coach role cannot open the editor', async ({ page }) => {
    await signInAs(page, ['athlete']);
    await page.goto('/coach/lessons/new');
    await expect(page).toHaveURL(/\/not-allowed/);
  });
});
