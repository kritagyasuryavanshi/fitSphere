import { expect, test } from '@playwright/test';
import { admin, coachWithProgram, signInAs, userIdByEmail } from './helpers';

const india = (offsetDays = 0) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date(Date.now() + offsetDays * 86_400_000));

test.describe('Progress', () => {
  test('gym progress numbers equal the logged data, and the athlete logs body weight', async ({ page }) => {
    const { programId, joinPath } = await coachWithProgram(`Muscle Builder ${Date.now()}`, {
      category: 'gym',
      coachName: 'Ananya',
      sessions: [{ day: 1, title: 'Upper A', items: [{ slug: 'barbell-bench-press', type: 'sets', prescription: { sets: 3, reps: 8, load_kg: 50 } }] }],
    });
    const email = await signInAs(page, ['athlete'], { name: 'Neha' });
    const athlete = await userIdByEmail(email);
    await page.goto(joinPath);
    await page.getByRole('button', { name: 'Join program' }).click();
    await expect(page.getByText(/You are in/)).toBeVisible();

    // Earlier: 3 x 8 at 50 kg outside the program. Today: the scheduled workout, 3 x 8 at 52.5 kg, all at RPE 8.
    const db = admin();
    const { data: bench } = await db.from('content_items').select('id').eq('slug', 'barbell-bench-press').single();
    const { data: session } = await db.from('program_sessions').select('id, program_versions!inner(program_id, version)').eq('program_versions.program_id', programId).eq('program_versions.version', 1).single();
    const logWorkout = async (row: { on_date: string; session_id?: string; program_id?: string; completed_at?: string }, loadKg: number) => {
      const { data: log, error } = await db.from('session_logs').insert({ athlete_id: athlete, category_id: 'gym', title: 'Upper A', ...row }).select('id').single();
      expect(error).toBeNull();
      const { data: item } = await db.from('item_logs').insert({ log_id: log!.id, position: 1, item_id: bench!.id, type: 'sets' }).select('id').single();
      expect((await db.from('set_logs').insert([1, 2, 3].map((n) => ({ item_log_id: item!.id, set_no: n, reps: 8, load_kg: loadKg, rpe: 8 })))).error).toBeNull();
    };
    await logWorkout({ on_date: india(-14) }, 50);
    await logWorkout({ on_date: india(), session_id: session!.id, program_id: programId, completed_at: new Date().toISOString() }, 52.5);

    await page.goto('/progress/gym');
    const summary = page.locator('dl[aria-label="Summary"]');
    await expect(summary).toContainText('Workouts done1of 1 planned so far');
    await expect(summary).toContainText('Adherence100%');
    await expect(summary).toContainText('Hard sets this week3');

    const row = page.getByRole('row', { name: /Barbell bench press/ });
    await expect(row).toContainText('52.5 kg × 8');
    await expect(row).toContainText('New best');
    await expect(row).toContainText('50 kg × 8');
    await expect(row).toContainText('Today');

    // Body weight.
    const weight = page.getByRole('region', { name: 'Body weight' });
    await weight.getByLabel("Today's weight (kg)").fill('72.45');
    await weight.getByRole('button', { name: 'Log weight' }).click();
    await expect(weight.getByText('Enter your weight in kg, from 20 to 400, with at most one decimal.')).toBeVisible();
    await expect(weight.getByLabel("Today's weight (kg)")).toHaveValue('72.45');
    await weight.getByLabel("Today's weight (kg)").fill('72.4');
    await weight.getByRole('button', { name: 'Log weight' }).click();
    await expect(weight.getByText('Saved 72.4 kg for today.')).toBeVisible();
    await expect(weight.getByLabel("Today's weight (kg)")).toHaveValue('');
    await expect(weight).toContainText('Latest, Today');
    await expect(weight.getByRole('list', { name: 'Recent weights' })).toContainText('72.4 kg');
    const { data: rows } = await db.from('body_metrics').select('weight_kg').eq('user_id', athlete).not('weight_kg', 'is', null);
    expect(rows!.map((r) => Number(r.weight_kg))).toEqual([72.4]);

    // The workout summary shows the same new best.
    await page.goto(`/session/${session!.id}/done?date=${india()}`);
    await expect(page.getByRole('row', { name: /Barbell bench press/ })).toContainText('New best');

    // The Progress tab opens gym progress for an athlete with only gym programs.
    await page.goto('/progress');
    await expect(page).toHaveURL(/\/progress\/gym$/);
  });
});
