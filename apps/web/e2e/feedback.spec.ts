import { expect, test } from '@playwright/test';
import { coachWithProgram, newPage, signInAs, signInWithEmail } from './helpers';

test.describe('Coach feedback', () => {
  test('the coach sends feedback, the athlete sees it on Today and replies, the coach sees the reply', async ({ page, browser }) => {
    const { coach, joinPath } = await coachWithProgram(`Ring Basics ${Date.now()}`, {
      sessions: [{ day: 1, title: 'Jab', items: [{ slug: 'skipping', type: 'time', prescription: { seconds: 300 } }] }],
    });
    await signInAs(page, ['athlete'], { name: 'Neha' });
    await page.goto(joinPath);
    await page.getByRole('button', { name: 'Join program' }).click();
    await expect(page.getByText(/You are in/)).toBeVisible();

    // The coach opens Neha from the board and sends feedback.
    const coachPage = await newPage(browser);
    await signInWithEmail(coachPage, coach.email);
    await coachPage.goto('/coach');
    await coachPage.getByRole('link', { name: /^Neha/ }).first().click();
    await expect(coachPage.getByRole('heading', { level: 1, name: 'Neha' })).toBeVisible();
    await expect(coachPage.getByRole('region', { name: 'Sign-up answers' })).toContainText('Days per week');
    const box = coachPage.getByLabel('Feedback for Neha');
    await coachPage.getByRole('button', { name: 'Send to Neha' }).click();
    await expect(box).toBeFocused();
    await box.fill('Keep the rear hand glued to your cheek.');
    await coachPage.getByRole('button', { name: 'Send to Neha' }).click();
    await expect(coachPage.getByText('Sent. Neha sees it on Today and in Coach feedback.')).toBeVisible();
    await expect(box).toHaveValue('');

    // Neha sees it on Today and replies from Coach feedback.
    await page.goto('/today');
    const card = page.getByRole('region', { name: 'Feedback from Vikram' });
    await expect(card).toContainText('Keep the rear hand glued to your cheek.');
    await card.getByRole('link', { name: 'Read and reply' }).click();
    await expect(page).toHaveURL(/\/account\/feedback$/);
    const item = page.getByRole('list', { name: 'Coach feedback' }).getByRole('listitem').first();
    await item.getByLabel('Reply to Vikram').fill('Got it. Touch-and-throw before each round.');
    await item.getByRole('button', { name: 'Send reply' }).click();
    await expect(item.getByText('Reply sent.')).toBeVisible();
    await expect(item).toContainText('Got it. Touch-and-throw before each round.');

    // The coach sees the reply.
    await coachPage.reload();
    await expect(coachPage.getByRole('list', { name: 'Feedback sent' })).toContainText('Got it. Touch-and-throw before each round.');
  });
});
