import { expect, test } from '@playwright/test';
import { admin, coachWithProgram, signInAs, userIdByEmail } from './helpers';

const yesterday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date(Date.now() - 86_400_000));

test.describe('Set logger', () => {
  test('an athlete logs a gym workout set by set, with last time and the next target', async ({ page }) => {
    const { joinPath } = await coachWithProgram(`Muscle Builder ${Date.now()}`, {
      category: 'gym',
      coachName: 'Ananya',
      sessions: [
        {
          day: 1,
          title: 'Upper A',
          items: [
            { slug: 'barbell-bench-press', type: 'sets', prescription: { sets: 3, reps: 8, load_kg: 50 } },
            { slug: 'push-up', type: 'sets', prescription: { sets: 2, reps: 10 } },
          ],
        },
      ],
    });
    await page.clock.install();
    const email = await signInAs(page, ['athlete'], { name: 'Neha' });
    const athlete = await userIdByEmail(email);

    // Last time: 3 x 8 at 50 kg on the bench, every set at the top of the range.
    const db = admin();
    const { data: bench } = await db.from('content_items').select('id').eq('slug', 'barbell-bench-press').single();
    const { data: old } = await db.from('session_logs').insert({ athlete_id: athlete, on_date: yesterday(), category_id: 'gym', title: 'Upper A' }).select('id').single();
    const { data: oldItem } = await db.from('item_logs').insert({ log_id: old!.id, position: 1, item_id: bench!.id, type: 'sets' }).select('id').single();
    expect((await db.from('set_logs').insert([1, 2, 3].map((n) => ({ item_log_id: oldItem!.id, set_no: n, reps: 8, load_kg: 50, rpe: 8 })))).error).toBeNull();

    await page.goto(joinPath);
    await page.getByRole('button', { name: 'Join program' }).click();
    await expect(page.getByText(/You are in/)).toBeVisible();
    await page.goto('/today');
    await page.getByRole('link', { name: 'Start session: Upper A' }).click();

    await expect(page.getByRole('heading', { level: 1, name: 'Barbell bench press' })).toBeVisible();
    await expect(page.getByText('Exercise 1 of 2')).toBeVisible();
    const sets = page.getByRole('region', { name: 'Your sets' });
    await expect(sets).toContainText('you did 3 × 8 at 50 kg. Every set hit 8, so today try 52.5 kg.');
    const form = sets.getByRole('form', { name: 'Set 1' });
    await expect(form.getByLabel('Reps')).toHaveValue('8');
    await expect(form.getByLabel('Load (kg)')).toHaveValue('52.5');
    await form.getByRole('button', { name: 'Log set 1' }).click();
    await expect(form.getByRole('alert')).toHaveText('Pick how hard the set was.');
    await form.getByLabel('Effort 8 of 10').check({ force: true });
    await form.getByRole('button', { name: 'Log set 1' }).click();

    // The rest timer starts after the set.
    await expect(sets.getByText('Rest before set 2')).toBeVisible();
    const rest = sets.getByRole('timer');
    await expect(rest).toHaveText(/^1:(30|2\d)$/);
    await sets.getByRole('button', { name: 'Add 30 s' }).click();
    await expect(rest).toHaveText(/^(2:00|1:5\d)$/);
    await page.clock.runFor(121_000);
    await expect(sets.getByText('Rest over', { exact: true })).toBeVisible();

    await sets.getByRole('form', { name: 'Set 2' }).getByRole('button', { name: 'Log set 2' }).click();
    await sets.getByRole('button', { name: 'Skip rest' }).click();
    const third = sets.getByRole('form', { name: 'Set 3' });
    await third.getByLabel('Reps').fill('7');
    await third.getByRole('button', { name: 'Log set 3' }).click();
    await expect(sets.getByText('All 3 sets logged.')).toBeVisible();
    await expect(sets.getByRole('row', { name: /^3 8 × 50 7 × 52.5 kg · RPE 8/ })).toBeVisible();

    // Push-ups: bodyweight, never logged before.
    await sets.getByRole('button', { name: 'Next exercise' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Push-up' })).toBeVisible();
    const push = page.getByRole('region', { name: 'Your sets' });
    await expect(push).toContainText('First time logging this exercise.');
    const p1 = push.getByRole('form', { name: 'Set 1' });
    await expect(p1.getByLabel('Load (kg)')).toHaveValue('');
    await p1.getByLabel('Effort 7 of 10').check({ force: true });
    await p1.getByRole('button', { name: 'Log set 1' }).click();
    const p2 = push.getByRole('form', { name: 'Set 2' });
    await p2.getByLabel('Effort 6 of 10').check({ force: true });
    await p2.getByRole('button', { name: 'Log set 2' }).click();
    await push.getByRole('button', { name: 'Finish session' }).click();

    // Totals equal the sets just logged: 8 + 8 + 7 reps at 52.5 kg is 1,207.5 kg; push-ups add no load.
    await expect(page.getByRole('heading', { name: 'Workout done.' })).toBeVisible();
    const summary = page.locator('dl[aria-label="Summary"]');
    await expect(summary).toContainText('Exercises logged2 / 2');
    await expect(summary).toContainText('Sets5');
    await expect(summary).toContainText('Volume1,207.5 kg');
    // Hard sets: at least one rep at RPE 7 or more, so the push-up set at 6 does not count. Both train chest first.
    await expect(summary).toContainText('Hard sets4');
    await expect(page.getByRole('region', { name: 'Hard sets by muscle today' }).getByRole('listitem')).toHaveText(['Chest4 sets']);
    await expect(page.getByRole('row', { name: 'Barbell bench press 8 × 52.5 kg, 8 × 52.5 kg, 7 × 52.5 kg' })).toBeVisible();
    await expect(page.getByRole('row', { name: 'Push-up 10 reps, 10 reps' })).toBeVisible();
    await page.getByRole('link', { name: 'Back to Today' }).click();
    await expect(page).toHaveURL(/\/today$/);
    await expect(page.getByRole('article', { name: 'Upper A' }).getByText('Done', { exact: true })).toBeVisible();

    const { data: today } = await db
      .from('session_logs')
      .select('completed_at, item_logs(position, set_logs(set_no, reps, load_kg, rpe))')
      .eq('athlete_id', athlete)
      .neq('id', old!.id)
      .single();
    expect(today!.completed_at).not.toBeNull();
    const byPosition = today!.item_logs
      .sort((a, b) => a.position - b.position)
      .map((i) => i.set_logs.sort((a, b) => a.set_no - b.set_no).map((s) => `${s.reps}x${s.load_kg ?? 'bw'}@${s.rpe}`));
    expect(byPosition).toEqual([
      ['8x52.5@8', '8x52.5@8', '7x52.5@8'],
      ['10xbw@7', '10xbw@6'],
    ]);
  });
});
