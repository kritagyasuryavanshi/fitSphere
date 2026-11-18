import { expect, test } from '@playwright/test';
import { coachWithProgram, newPage, signInAs, signInWithEmail } from './helpers';

test.describe('leaving and removal', () => {
  test('an athlete leaves a program from My programs, and the coach no longer lists them', async ({ page, browser }) => {
    const title = `Boxing Fundamentals ${Date.now()}`;
    const { coach, programId, joinPath } = await coachWithProgram(title);
    await signInAs(page, ['athlete'], { name: 'Kabir' });
    await page.goto(joinPath);
    await page.getByRole('button', { name: 'Join program' }).click();
    await expect(page.getByText(`You are in ${title}.`)).toBeVisible();

    await page.goto('/account');
    await page.getByRole('link', { name: 'My programs' }).click();
    const card = page.getByRole('list', { name: 'My programs' }).getByRole('listitem').filter({ hasText: title });
    await expect(card).toContainText('Vikram · week 1 of 6');
    await card.getByRole('link', { name: /^Leave program/ }).click();
    await expect(page.getByRole('alertdialog', { name: `Leave ${title}?` })).toContainText('Vikram stops seeing your logs');
    await page.getByRole('link', { name: 'Keep training' }).click();
    await expect(card).toBeVisible();
    await card.getByRole('link', { name: /^Leave program/ }).click();
    await page.getByRole('button', { name: 'Leave program' }).click();
    await expect(page.getByText('You left the program.')).toBeVisible();
    await expect(page.getByText('No programs yet')).toBeVisible();

    const coachPage = await newPage(browser);
    await signInWithEmail(coachPage, coach.email);
    await coachPage.goto(`/coach/programs/${programId}/invite`);
    await expect(coachPage.getByText('Nobody has joined yet.')).toBeVisible();

    // Leaving was their choice, so the link lets them back in.
    await page.goto(joinPath);
    await expect(page.getByRole('button', { name: 'Join program' })).toBeVisible();
  });

  test('a coach removes an athlete, who cannot rejoin through the link', async ({ page, browser }) => {
    const title = `Footwork Lab ${Date.now()}`;
    const { coach, programId, joinPath } = await coachWithProgram(title);
    const athlete = await newPage(browser);
    await signInAs(athlete, ['athlete'], { name: 'Kabir' });
    await athlete.goto(joinPath);
    await athlete.getByRole('button', { name: 'Join program' }).click();
    await expect(athlete.getByText(`You are in ${title}.`)).toBeVisible();

    await signInWithEmail(page, coach.email);
    await page.goto(`/coach/programs/${programId}/invite`);
    await page.getByRole('list', { name: 'Joined athletes' }).getByRole('link', { name: /^Remove/ }).click();
    const dialog = page.getByRole('alertdialog', { name: `Remove Kabir from ${title}?` });
    await expect(dialog).toContainText('Your past feedback stays visible to them.');
    await page.getByRole('button', { name: 'Remove Kabir' }).click();
    await expect(page.getByText('Removed. You no longer see their logs')).toBeVisible();
    await expect(page.getByText('Nobody has joined yet.')).toBeVisible();
    await page.goto('/coach/programs');
    await expect(page.getByRole('list', { name: 'Programs' }).getByRole('listitem').filter({ hasText: title })).toContainText('no athletes yet');

    await athlete.goto(joinPath);
    await expect(athlete.getByText('Vikram removed you from this program')).toBeVisible();
    await expect(athlete.getByRole('button', { name: 'Join program' })).toHaveCount(0);
    await athlete.goto('/account/programs');
    await expect(athlete.getByText('No programs yet')).toBeVisible();
  });

  test('an athlete cannot open the remove screen', async ({ page }) => {
    const { programId } = await coachWithProgram(`Southpaw ${Date.now()}`);
    await signInAs(page, ['athlete']);
    await page.goto(`/coach/programs/${programId}/members/${crypto.randomUUID()}/remove`);
    await expect(page).toHaveURL(/\/not-allowed/);
  });
});
