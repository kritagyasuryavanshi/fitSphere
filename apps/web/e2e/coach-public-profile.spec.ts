import { expect, test } from '@playwright/test';
import { admin, coachWithProgram, createUser } from './helpers';

test('a live coach profile shows FitSphere stats, keeps programs private, and marks what is self-reported', async ({ page }) => {
  const { coach, programId } = await coachWithProgram('Boxing Fundamentals', { coachName: 'Rohan' });
  const db = admin();
  const ok = ({ error }: { error: unknown }) => expect(error).toBeNull();
  const { data: version } = await db.rpc('current_coach_agreement');
  ok(await db.from('coach_profiles').insert({ coach_id: coach.id, headline: 'Defence and ring craft', years: 15, status: 'live', agreement_version: version }));
  ok(await db.from('packages').insert({ coach_id: coach.id, title: 'Monthly', kind: 'monthly', price_paise: 350000, live: true }));
  // Three athletes in the coach's invite-only program.
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
  // Too few athletes to show percentages without exposing one client's numbers.
  await expect(stats.getByText('Not enough clients yet')).toHaveCount(2);

  // The program is private: it never shows on the public profile.
  await expect(page.getByText('Boxing Fundamentals')).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'Reviews' })).toContainText('No reviews yet.');
});
