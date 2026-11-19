import { expect, test } from '@playwright/test';
import { admin, coachWithProgram, createUser } from './helpers';

test('a live coach profile shows FitSphere stats, the portfolio, and marks what is self-reported', async ({ page }) => {
  const { coach, programId } = await coachWithProgram('Boxing Fundamentals', { coachName: 'Rohan' });
  const db = admin();
  const ok = ({ error }: { error: unknown }) => expect(error).toBeNull();
  const { data: version } = await db.rpc('current_coach_agreement');
  ok(await db.from('coach_profiles').insert({ coach_id: coach.id, headline: 'Defence and ring craft', years: 15, status: 'live', agreement_version: version }));
  ok(await db.from('packages').insert({ coach_id: coach.id, title: 'Monthly', kind: 'monthly', price_paise: 350000, live: true }));
  // Three athletes in the program now: enough for it to be listed.
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
  for (const name of ['Asha', 'Dev', 'Isha']) {
    const athlete = await createUser(['athlete'], { name });
    ok(await db.from('enrollments').insert({ program_id: programId, athlete_id: athlete.id, start_date: today }));
  }

  await page.goto(`/coaches/${coach.id}`);
  await expect(page.getByRole('heading', { level: 1, name: 'Rohan' })).toBeVisible();
  await expect(page.getByText('15 years coaching (self-reported)')).toBeVisible();
  await expect(page.getByText('Credentials self-reported')).toBeVisible();

  const stats = page.getByRole('region', { name: 'On FitSphere' });
  await expect(stats.getByText('From FitSphere records, not entered by the coach.')).toBeVisible();
  await expect(stats.getByRole('definition').first()).toHaveText('3');
  // Adherence counts only athletes with a session scheduled so far; stayed-3-months needs athletes who joined 90+ days ago. Too few to show percentages without exposing one client's numbers.
  await expect(stats.getByText('Not enough clients yet')).toHaveCount(2);

  const portfolio = page.getByRole('region', { name: 'Portfolio' });
  await expect(portfolio).toContainText('Program: Boxing Fundamentals');
  await expect(portfolio).toContainText('6 weeks · 3 athletes enrolled now');
  await expect(page.getByRole('region', { name: 'Reviews' })).toContainText('No reviews yet.');
});
