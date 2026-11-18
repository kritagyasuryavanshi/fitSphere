import { expect, test } from '@playwright/test';
import { signInAs } from './helpers';

test.describe('program builder', () => {
  test('a coach builds a boxing and an S&C session, saves, and publishes', async ({ page }) => {
    await signInAs(page, ['athlete', 'coach'], { name: 'Vikram' });
    await page.goto('/coach/programs');
    await expect(page.getByText('No programs yet')).toBeVisible();
    await page.getByRole('link', { name: 'New program' }).click();
    await page.getByLabel('Program name').fill('Boxing Fundamentals');
    await page.getByLabel('Main sport').selectOption({ label: 'Boxing' });
    await page.getByRole('button', { name: 'Start building' }).click();
    await expect(page).toHaveURL(/\/coach\/programs\/[0-9a-f-]{36}$/);

    const publish = page.getByRole('button', { name: 'Publish changes' });
    await expect(publish).toBeDisabled();

    // Boxing session on day 1: the jab in rounds, with a cue.
    await page.getByRole('button', { name: 'Add session to week 1' }).click();
    await page.getByLabel('Title for session 1').fill('Jab and footwork');
    await page.getByLabel('Search drills').fill('jab');
    await page.getByRole('button', { name: 'Add The Jab' }).click();
    const jab = page.getByRole('list', { name: 'Drills in Day 1 · Jab and footwork' });
    await expect(jab).toContainText('3 × 2 min · rest 1 min');
    await page.getByLabel('Rounds', { exact: true }).fill('4');
    await page.getByLabel('Rest (seconds)').fill('45');
    await page.getByLabel('Coach cue for athletes').fill('Step with the lead foot as the jab lands.');
    await expect(jab).toContainText('4 × 2 min · rest 45 s');

    // S&C session on day 3: two exercises in sets, reordered.
    await page.getByRole('button', { name: 'Add session to week 1' }).click();
    await page.getByLabel('Day for session 2').selectOption('3');
    await page.getByLabel('Title for session 2').fill('Rotational power');
    await page.getByLabel('Search drills').fill('');
    await page.getByRole('group', { name: 'Sport' }).getByRole('button', { name: 'Strength & Conditioning' }).click();
    await page.getByRole('button', { name: 'Add Kettlebell swing' }).click();
    await page.getByLabel('Load (kg, optional)').fill('16');
    await page.getByRole('button', { name: 'Add Goblet squat' }).click();
    await page.getByLabel('Reps', { exact: true }).fill('0');
    await expect(page.getByRole('region', { name: 'Goblet squat' }).getByRole('alert')).toHaveText('Reps must be 1 to 200.');
    await expect(publish).toBeDisabled();
    await page.getByLabel('Reps', { exact: true }).fill('8');
    await page.getByRole('button', { name: /move Goblet squat up/ }).click();
    const power = page.getByRole('list', { name: 'Drills in Day 3 · Rotational power' }).getByRole('listitem');
    await expect(power.nth(0)).toContainText('Goblet squat');
    await expect(power.nth(1)).toContainText('3 × 10 · 16 kg');

    // Save, and the draft comes back after a reload.
    await page.getByRole('button', { name: 'Save draft' }).click();
    await expect(page.getByText('Draft saved')).toBeVisible();
    await page.reload();
    await expect(page.getByRole('list', { name: 'Drills in Day 1 · Jab and footwork' })).toContainText('4 × 2 min · rest 45 s');
    await expect(page.getByRole('list', { name: 'Drills in Day 3 · Rotational power' }).getByRole('listitem').nth(0)).toContainText('Goblet squat');
    await page.getByRole('button', { name: 'Edit The Jab' }).click();
    await expect(page.getByLabel('Coach cue for athletes')).toHaveValue('Step with the lead foot as the jab lands.');

    await page.getByRole('button', { name: 'Publish changes' }).click();
    await expect(page).toHaveURL(/\/coach\/programs\?published=1/);
    await expect(page.getByText('Published version 1.')).toBeVisible();
    const card = page.getByRole('list', { name: 'Programs' }).getByRole('listitem').filter({ hasText: 'Boxing Fundamentals' });
    await expect(card.getByText('Live · v1')).toBeVisible();
    await expect(card.getByText('Unpublished changes')).toHaveCount(0);

    // Saving without a change is not an unpublished change; a real edit is.
    await card.getByRole('link', { name: /Edit.*Boxing Fundamentals/ }).click();
    await page.getByRole('button', { name: 'Save draft' }).click();
    await expect(page.getByText('Draft saved')).toBeVisible();
    await page.goto('/coach/programs');
    await expect(card.getByText('Unpublished changes')).toHaveCount(0);
    await card.getByRole('link', { name: /Edit.*Boxing Fundamentals/ }).click();
    await page.getByRole('button', { name: 'Edit The Jab' }).click();
    await page.getByLabel('Rounds', { exact: true }).fill('5');
    await expect(page.getByText('Unsaved changes')).toBeVisible();
    await page.getByRole('button', { name: 'Save draft' }).click();
    await expect(page.getByText('Draft saved')).toBeVisible();
    await expect(page.getByText('Unsaved changes')).toHaveCount(0);
    await page.goto('/coach/programs');
    await expect(card.getByText('Unpublished changes')).toBeVisible();
  });

  test('an athlete without the coach role cannot open the builder', async ({ page }) => {
    await signInAs(page, ['athlete']);
    await page.goto('/coach/programs/new');
    await expect(page).toHaveURL(/\/not-allowed/);
  });
});
