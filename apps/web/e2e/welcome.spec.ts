import { indiaToday } from '@fitsphere/core';
import { createDbClient } from '@fitsphere/db';
import { expect, test, type Page } from '@playwright/test';
import { admin, signUp } from './helpers';

// A date of birth `years` before today in India, plus `days`.
function birthday(years: number, days = 0) {
  const date = new Date(`${indiaToday()}T00:00:00Z`);
  date.setUTCFullYear(date.getUTCFullYear() - years);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

async function fillAboutYou(page: Page, name: string, dob: string, sports: string[]) {
  const [year, month, day] = dob.split('-') as [string, string, string];
  await page.getByLabel('First name').fill(name);
  await page.getByLabel('Day').fill(day);
  await page.getByLabel('Month').fill(month);
  await page.getByLabel('Year').fill(year);
  for (const sport of sports) await page.getByRole('checkbox', { name: new RegExp(sport) }).check();
  await page.getByRole('button', { name: 'Continue' }).click();
}

async function savedProfile(email: string) {
  const { data } = await admin().auth.admin.listUsers({ perPage: 1000 });
  const id = data.users.find((u) => u.email === email)?.id ?? '';
  const { data: profile } = await admin().from('profiles').select('display_name, date_of_birth').eq('id', id).single();
  const { data: prefs } = await admin().from('athlete_prefs').select('category_id').eq('user_id', id).order('category_id');
  return { ...profile, sports: prefs?.map((p) => p.category_id) };
}

test('an adult finishes step 1 and their answers are saved', async ({ page }, testInfo) => {
  const email = `e2e-adult-${testInfo.project.name}-${Date.now()}@test.fitsphere`;
  await signUp(page, email);
  // Exactly 18 today passes.
  await fillAboutYou(page, 'Kabir', birthday(18), ['Boxing', 'Gym & Fitness']);

  await expect(page).toHaveURL('/');
  await expect(page.getByText(`Signed in as ${email}`)).toBeVisible();
  expect(await savedProfile(email)).toEqual({ display_name: 'Kabir', date_of_birth: birthday(18), sports: ['boxing', 'gym'] });
});

test('under 18 shows the block screen and stores nothing', async ({ page }, testInfo) => {
  const email = `e2e-minor-${testInfo.project.name}-${Date.now()}@test.fitsphere`;
  await signUp(page, email);
  // One day short of 18.
  await fillAboutYou(page, 'Kid', birthday(18, 1), ['Boxing']);

  await expect(page).toHaveURL('/welcome/not-eligible');
  await expect(page.getByRole('heading', { name: 'FitSphere is for adults, for now' })).toBeVisible();
  expect(await savedProfile(email)).toEqual({ display_name: '', date_of_birth: null, sports: [] });

  // The session ended too.
  await page.goto('/');
  await expect(page.getByRole('link', { name: 'Log in or join' })).toBeVisible();
});

test('step 1 shows inline errors and keeps what was typed', async ({ page }, testInfo) => {
  await signUp(page, `e2e-errors-${testInfo.project.name}-${Date.now()}@test.fitsphere`);
  await page.getByLabel('First name').fill('Kabir');
  await page.getByLabel('Day').fill('31');
  await page.getByLabel('Month').fill('04');
  await page.getByLabel('Year').fill('1998');
  await page.getByRole('button', { name: 'Continue' }).click();

  await expect(page.getByText('Enter a real date, like 12 06 1998')).toBeVisible();
  await expect(page.getByText('Pick at least one sport')).toBeVisible();
  await expect(page.getByLabel('First name')).toHaveValue('Kabir');
  await expect(page.getByLabel('Day')).toHaveValue('31');
  await expect(page.getByRole('checkbox', { name: /Cricket/ })).toBeDisabled();
});

test('the 18+ rule holds when the browser is bypassed', async ({}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'An API check; one viewport is enough.');
  const db = createDbClient(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '', process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '');
  await db.auth.signInWithPassword({ email: 'athlete@test.fitsphere', password: 'password123' });
  const { error } = await db.rpc('complete_about_you', { first_name: 'Kid', birth_date: birthday(17), sports: ['boxing'] });
  expect(error?.message).toBe('under_18');
});

test('step 1 needs a signed-in user', async ({ page }) => {
  await page.goto('/welcome/1');
  await expect(page).toHaveURL('/sign-in');
});
