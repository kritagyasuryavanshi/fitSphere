import { expect, test } from '@playwright/test';
import { coachWithProgram, newPage, signInAs, signInWithEmail } from './helpers';

// M3-15, the M3 Verify line in docs/designs/fitsphere-v1.md: a coach's program with one boxing and one S&C session; an
// athlete joins by link; Today shows both; the athlete logs rounds for boxing and sets x reps x load for S&C; the coach
// sees the logs and leaves feedback; the athlete sees it; progress numbers equal the logged data.
// The builder screens have their own test (program-builder.spec.ts); the gym path is set-logger.spec.ts and progress.spec.ts.
test.describe('Milestone check M3', () => {
  test('coach program to athlete logs to coach feedback to progress', async ({ page, browser }) => {
    test.setTimeout(90_000);
    const { coach, joinPath } = await coachWithProgram(`Fight Camp ${Date.now()}`, {
      sessions: [
        { day: 1, title: 'Jab', items: [{ slug: 'jab', type: 'rounds', prescription: { rounds: 2, work_s: 10, rest_s: 0 } }] },
        { day: 1, title: 'Strength', items: [{ slug: 'kettlebell-swing', type: 'sets', prescription: { sets: 2, reps: 10, load_kg: 16 } }] },
      ],
    });
    await page.clock.install();
    await signInAs(page, ['athlete'], { name: 'Neha' });
    await page.goto(joinPath);
    await page.getByRole('button', { name: 'Join program' }).click();
    await expect(page.getByText(/You are in/)).toBeVisible();

    // Today shows both sessions.
    await page.goto('/today');
    await expect(page.getByRole('link', { name: 'Start session: Jab' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Start session: Strength' })).toBeVisible();

    // Boxing: two rounds on the timer, then technique and effort.
    await page.getByRole('link', { name: 'Start session: Jab' }).click();
    await page.getByRole('button', { name: 'Start timer' }).click();
    await page.clock.runFor(22_000);
    const log = page.getByRole('region', { name: 'Log it' });
    await expect(log.locator('output')).toHaveText('2');
    await log.getByLabel('Technique 4 of 5').check({ force: true });
    await log.getByLabel('Effort 7 of 10').check({ force: true });
    await log.getByRole('button', { name: 'Save and finish' }).click();
    await expect(page.getByRole('heading', { name: 'Session done.' })).toBeVisible();
    await expect(page.locator('dl[aria-label="Summary"]')).toContainText('Rounds2 / 2');

    // S&C: two sets of 10 at 16 kg.
    await page.goto('/today');
    await page.getByRole('link', { name: 'Start session: Strength' }).click();
    const sets = page.getByRole('region', { name: 'Your sets' });
    for (const n of [1, 2]) {
      const form = sets.getByRole('form', { name: `Set ${n}` });
      await form.getByLabel('Reps').fill('10');
      await form.getByLabel('Load (kg)').fill('16');
      await form.getByLabel('Effort 7 of 10').check({ force: true });
      await form.getByRole('button', { name: `Log set ${n}` }).click();
      if (n === 1) await sets.getByRole('button', { name: 'Skip rest' }).click();
    }
    await sets.getByRole('button', { name: 'Finish session' }).click();
    const summary = page.locator('dl[aria-label="Summary"]');
    await expect(summary).toContainText('Sets2');
    await expect(summary).toContainText('Volume320 kg');

    // The coach sees both logs and leaves feedback.
    const coachPage = await newPage(browser);
    await signInWithEmail(coachPage, coach.email);
    await coachPage.goto('/coach');
    await coachPage.getByRole('link', { name: /^Neha/ }).first().click();
    const logs = coachPage.getByRole('region', { name: 'Session logs' });
    await expect(logs).toContainText('2 of 2 rounds');
    await expect(logs).toContainText('10 × 16 kg · RPE 7');
    await coachPage.getByLabel('Feedback for Neha').fill('Good rounds. Add a third set next week.');
    await coachPage.getByRole('button', { name: 'Send to Neha' }).click();
    await expect(coachPage.getByText('Sent. Neha sees it on Today and in Coach feedback.')).toBeVisible();

    // The athlete sees the feedback.
    await page.goto('/today');
    await expect(page.getByRole('region', { name: 'Feedback from Vikram' })).toContainText('Good rounds. Add a third set next week.');

    // Progress equals what was logged: 2 of 2 sessions, 100%, the swing record and the jab rating.
    await page.goto('/progress');
    const stats = page.locator('dl[aria-label="Summary"]');
    await expect(stats).toContainText('Sessions done2of 2 planned so far');
    await expect(stats).toContainText('Adherence100%');
    await expect(page.getByRole('row', { name: /Kettlebell swing/ })).toContainText('16 kg × 10');
    await expect(page.getByRole('region', { name: 'Skills' })).toContainText('4.0 / 5 · 1 log');
  });
});
