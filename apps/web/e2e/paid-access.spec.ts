import { expect, test } from '@playwright/test';
import { admin, coachWithProgram, createUser, newPage, signInWithEmail } from './helpers';

test('a coach assigns a program to a paying client, who sees it in My programs', async ({
  page,
  browser,
}) => {
  const title = `Paid Boxing ${Date.now()}`;
  const { coach } = await coachWithProgram(title);
  const db = admin();
  const { data: version } = await db.rpc('current_coach_agreement');
  expect(
    (
      await db
        .from('coach_profiles')
        .insert({ coach_id: coach.id, headline: 'Boxing', status: 'live', agreement_version: version })
    ).error,
  ).toBeNull();
  const athlete = await createUser(['athlete'], { name: 'Kabir' });
  // A paid, shared engagement straight in the database: paying has its own test (payments.spec.ts).
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
  expect(
    (
      await db.from('engagements').insert({
        athlete_id: athlete.id,
        coach_id: coach.id,
        package_title: 'Monthly',
        package_kind: 'monthly',
        price_paise: 450000,
        fee_bps: 1500,
        start_date: today,
        days_per_week: 3,
        status: 'active',
        share_data: true,
        paid_through: today,
      })
    ).error,
  ).toBeNull();

  await signInWithEmail(page, coach.email);
  await page.goto('/coach/clients');
  await page.getByLabel('Program for Kabir').selectOption({ label: title });
  await page.getByRole('button', { name: 'Assign to Kabir' }).click();
  await expect(page.getByRole('status')).toHaveText('Assigned. Kabir sees it in My programs.');

  const athletePage = await newPage(browser);
  await signInWithEmail(athletePage, athlete.email);
  await athletePage.goto('/account/programs');
  await expect(athletePage.getByRole('list', { name: 'My programs' }).getByRole('listitem').filter({ hasText: title })).toBeVisible();
});
