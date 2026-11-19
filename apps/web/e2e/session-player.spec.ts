import { expect, test } from '@playwright/test';
import { admin, coachWithProgram, signInAs, userIdByEmail } from './helpers';

test.describe('Boxing session player', () => {
  test('an athlete runs the timer and logs a full session from Today', async ({ page }) => {
    const { joinPath } = await coachWithProgram(`Boxing Fundamentals ${Date.now()}`, {
      sessions: [
        {
          day: 1,
          title: 'Jab and footwork',
          items: [
            { slug: 'jab', type: 'rounds', prescription: { rounds: 2, work_s: 60, rest_s: 30 }, cue: 'Snap it back to the chin.' },
            { slug: 'skipping', type: 'time', prescription: { seconds: 60 } },
          ],
        },
      ],
    });
    await page.clock.install();
    const email = await signInAs(page, ['athlete'], { name: 'Kabir' });
    await page.goto(joinPath);
    await page.getByRole('button', { name: 'Join program' }).click();
    await expect(page.getByText(/You are in/)).toBeVisible();

    await page.goto('/today');
    await page.getByRole('link', { name: 'Start session: Jab and footwork' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'The Jab' })).toBeVisible();
    await expect(page.getByText('Drill 1 of 2')).toBeVisible();
    const timer = page.getByRole('timer');
    const phase = page.getByRole('region', { name: 'Round timer' });
    await expect(phase.getByText('Snap it back to the chin.')).toBeVisible();
    await expect(timer).toHaveText('1:00');
    await expect(phase).toContainText('Round 1 of 2 · Ready');

    // Work, rest, pause, skip rest, next round, done.
    await page.getByRole('button', { name: 'Start timer' }).click();
    await page.clock.runFor(61_000);
    await expect(phase).toContainText('Round 1 of 2 · Rest');
    await page.getByRole('button', { name: 'Pause' }).click();
    const paused = await timer.textContent();
    await page.clock.runFor(10_000);
    await expect(timer).toHaveText(paused!);
    await page.getByRole('button', { name: 'Resume' }).click();
    await page.getByRole('button', { name: 'Skip rest' }).click();
    await expect(phase).toContainText('Round 2 of 2 · Work');
    await page.clock.runFor(61_000);
    await expect(phase).toContainText('All 2 rounds done');

    // Log the drill; rounds done follows the timer.
    const log = page.getByRole('region', { name: 'Log it' });
    await expect(log.locator('output')).toHaveText('2');
    await log.getByRole('button', { name: 'Save and next drill' }).click();
    await expect(log.getByRole('alert')).toHaveText('Pick a technique feel and an effort.');
    await log.getByLabel('Technique 4 of 5').check({ force: true });
    await log.getByLabel('Effort 7 of 10').check({ force: true });
    await log.getByLabel('Note for your coach').fill('Lead foot landing late on round 2.');
    await log.getByRole('button', { name: 'Save and next drill' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Skipping rope' })).toBeVisible();

    // Leaving and coming back resumes at the next drill.
    await page.getByRole('link', { name: 'End session' }).click();
    await page.getByRole('link', { name: 'Continue session: Jab and footwork' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Skipping rope' })).toBeVisible();
    await expect(page.getByText('Drill 2 of 2')).toBeVisible();
    await page.getByRole('button', { name: 'Start timer' }).click();
    await page.clock.runFor(61_000);
    await expect(timer).toHaveText('0:00');
    await log.getByLabel('Technique 3 of 5').check({ force: true });
    await log.getByLabel('Effort 6 of 10').check({ force: true });
    await log.getByRole('button', { name: 'Save and finish' }).click();

    await expect(page).toHaveURL(/\/today$/);
    const card = page.getByRole('article', { name: 'Jab and footwork' });
    await expect(card.getByText('Done', { exact: true })).toBeVisible();
    await expect(card.getByRole('link', { name: /Start session/ })).toHaveCount(0);

    // Review opens on the summary; an edit saves and returns there without leaving the session.
    await card.getByRole('link', { name: /Review your log/ }).click();
    await expect(page.getByRole('heading', { name: 'Session done' })).toBeVisible();
    await page.getByRole('button', { name: 'Edit The Jab' }).click();
    await log.getByLabel('Effort 8 of 10').check({ force: true });
    await log.getByRole('button', { name: 'Save and back to summary' }).click();
    await expect(page.getByRole('heading', { name: 'Session done' })).toBeVisible();

    // The saved log is exactly what was entered.
    const { data } = await admin()
      .from('session_logs')
      .select('title, completed_at, item_logs(position, type, rounds_done, rounds_planned, technique, effort, note)')
      .eq('athlete_id', await userIdByEmail(email))
      .single();
    expect(data!.title).toBe('Jab and footwork');
    expect(data!.completed_at).not.toBeNull();
    expect(data!.item_logs.sort((a, b) => a.position - b.position)).toEqual([
      { position: 1, type: 'rounds', rounds_done: 2, rounds_planned: 2, technique: 4, effort: 8, note: 'Lead foot landing late on round 2.' },
      { position: 2, type: 'time', rounds_done: null, rounds_planned: null, technique: 3, effort: 6, note: '' },
    ]);
  });

  test('a session that is not scheduled for the athlete does not open', async ({ page }) => {
    const { programId } = await coachWithProgram(`Boxing Fundamentals ${Date.now()}`, {
      sessions: [{ day: 1, title: 'Jab', items: [{ slug: 'jab', type: 'rounds', prescription: { rounds: 2, work_s: 60, rest_s: 30 } }] }],
    });
    const { data: v1 } = await admin().from('program_versions').select('program_sessions(id)').eq('program_id', programId).eq('version', 1).single();
    await signInAs(page, ['athlete'], { name: 'Kabir' });
    await page.goto(`/session/${v1!.program_sessions[0]!.id}`);
    await expect(page.getByText(/could not be found/i)).toBeVisible();
    await expect(page.getByRole('timer')).toHaveCount(0);
  });
});
