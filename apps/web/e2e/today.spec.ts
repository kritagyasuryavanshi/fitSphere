import { expect, test } from '@playwright/test';
import { admin, coachWithProgram, signInAs, userIdByEmail } from './helpers';

async function join(page: import('@playwright/test').Page, path: string) {
  await page.goto(path);
  await page.getByRole('button', { name: 'Join program' }).click();
  await expect(page.getByText(/You are in/)).toBeVisible();
}

test.describe('Today', () => {
  test('a gym-only athlete is pointed at the gym, not boxing, on Today and Progress', async ({ page }) => {
    const email = await signInAs(page, ['athlete'], { name: 'Asha' });
    const { error } = await admin().from('athlete_prefs').insert({ user_id: await userIdByEmail(email), category_id: 'gym' });
    expect(error).toBeNull();
    await page.goto('/today');
    await expect(page.getByRole('link', { name: 'Browse Gym & Fitness exercises' })).toHaveAttribute('href', '/learn/gym');
    await page.goto('/progress');
    await expect(page).toHaveURL(/\/progress\/gym$/);
    // The other tab still opens the boxing and S&C view.
    await page.getByRole('link', { name: 'Boxing and S&C' }).click();
    await expect(page).toHaveURL(/\/progress\?view=training$/);
  });

  test('with no program, the empty state opens an invite from a pasted link', async ({ page }) => {
    const { joinPath } = await coachWithProgram(`Footwork Lab ${Date.now()}`);
    await signInAs(page, ['athlete'], { name: 'Kabir' });
    await page.goto('/today');
    await expect(page.getByRole('heading', { name: 'No program yet' })).toBeVisible();
    await expect(page.getByText('Welcome, Kabir')).toBeVisible();
    // No sport chosen: the whole library, never boxing by default.
    await expect(page.getByRole('link', { name: 'Browse the library' })).toHaveAttribute('href', '/learn');

    await page.getByLabel('I have an invite link').fill('not a link');
    await page.getByRole('button', { name: 'Open the invite' }).click();
    await expect(page.getByText('Paste the whole link your coach sent')).toBeVisible();
    await page.getByLabel('I have an invite link').fill(`http://localhost:3000${joinPath}`);
    await page.getByRole('button', { name: 'Open the invite' }).click();
    await expect(page).toHaveURL(new RegExp(`${joinPath}$`));
    await expect(page.getByRole('button', { name: 'Join program' })).toBeVisible();
  });

  test('an athlete in two programs sees both sessions today, in the week strip too', async ({ page }) => {
    const boxing = await coachWithProgram(`Boxing Fundamentals ${Date.now()}`, {
      sessions: [
        { day: 1, title: 'Jab and footwork', items: [{ slug: 'jab', type: 'rounds', prescription: { rounds: 3, work_s: 120, rest_s: 45 }, cue: 'Snap it back to the chin.' }] },
        { day: 3, title: 'The cross', items: [] },
      ],
    });
    const sc = await coachWithProgram(`Ring Engine ${Date.now()}`, {
      category: 'sc',
      coachName: 'Ananya',
      sessions: [{ day: 1, title: 'Rotational power', items: [{ slug: 'goblet-squat', type: 'sets', prescription: { sets: 3, reps: 8, load_kg: 16 } }] }],
    });
    await signInAs(page, ['athlete'], { name: 'Kabir' });
    await join(page, boxing.joinPath);
    await join(page, sc.joinPath);

    await page.goto('/today');
    await expect(page.getByText('2 sessions today')).toBeVisible();
    const sessions = page.getByRole('list', { name: "Today's sessions" });
    const jab = sessions.getByRole('article', { name: 'Jab and footwork' });
    await expect(jab).toContainText(/Boxing · Boxing Fundamentals \d+, week 1 · Vikram/);
    await expect(jab).toContainText('3 × 2 min · rest 45 s');
    await expect(jab).toContainText('Snap it back to the chin.');
    await expect(jab.getByRole('link', { name: 'The Jab' })).toHaveAttribute('href', '/learn/boxing/jab');
    const power = sessions.getByRole('article', { name: 'Rotational power' });
    await expect(power).toContainText(/Strength & Conditioning · Ring Engine \d+, week 1 · Ananya/);
    await expect(power).toContainText('3 × 8 · 16 kg');

    const today = page.getByRole('list', { name: 'This week' }).locator('[aria-current="date"]');
    await expect(today).toContainText('Today');
  });

  test('on a day without a session, Today says rest and names the next one', async ({ page }) => {
    const { joinPath } = await coachWithProgram(`Southpaw basics ${Date.now()}`, { sessions: [{ day: 3, title: 'Southpaw stance', items: [] }] });
    await signInAs(page, ['athlete'], { name: 'Kabir' });
    await join(page, joinPath);
    await page.goto('/today');
    await expect(page.getByText('Rest day', { exact: true })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Rest day' })).toContainText(/Next: .+ · Southpaw stance/);
  });

  test('a version that starts tomorrow decides tomorrow, not the version in effect today', async ({ page }) => {
    const { programId, joinPath } = await coachWithProgram(`Southpaw basics ${Date.now()}`, { sessions: [{ day: 3, title: 'Old day three', items: [] }] });
    // Version 2, published today, starts tomorrow and moves the session to day 2.
    const db = admin();
    const tomorrow = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date(Date.now() + 86_400_000));
    const { data: v2 } = await db
      .from('program_versions')
      .update({ published_at: new Date().toISOString(), effective_from: tomorrow, title: 'Southpaw basics', summary: '', weeks: 6 })
      .eq('program_id', programId)
      .eq('version', 2)
      .select('id')
      .single();
    expect((await db.from('program_sessions').insert({ version_id: v2!.id, week: 1, day: 2, position: 1, title: 'New day two' })).error).toBeNull();
    expect((await db.from('program_versions').insert({ program_id: programId, version: 3 })).error).toBeNull();

    await signInAs(page, ['athlete'], { name: 'Kabir' });
    await join(page, joinPath);
    await page.goto('/today');
    await expect(page.getByText('Rest day', { exact: true })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Rest day' })).toContainText(/Next: .+ · New day two/);
  });

  test('a coach without the athlete role cannot open Today', async ({ page }) => {
    await signInAs(page, ['coach']);
    await page.goto('/today');
    await expect(page).toHaveURL(/\/not-allowed/);
  });
});
