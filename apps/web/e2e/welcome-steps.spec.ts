import { expect, test } from '@playwright/test';
import { admin, fillAboutYou, signUp, userIdByEmail } from './helpers';

async function savedSignUp(email: string) {
  const id = await userIdByEmail(email);
  const db = admin();
  const [{ data: prefs }, { data: basics }, { data: consents }, { data: metrics }] = await Promise.all([
    db.from('athlete_prefs').select('category_id, answers').eq('user_id', id).order('category_id'),
    db.from('athlete_basics').select('days_per_week, equipment, injury_notes').eq('user_id', id).maybeSingle(),
    db.from('consents').select('purpose, granted').eq('user_id', id),
    db.from('body_metrics').select('weight_kg, height_cm').eq('user_id', id),
  ]);
  return { prefs, basics, consents, metrics };
}

test('a full sign-up saves every answer, and the summary shows them', async ({ page }, testInfo) => {
  const email = `e2e-full-${testInfo.project.name}-${Date.now()}@test.fitsphere`;
  await signUp(page, email);
  await fillAboutYou(page, 'Kabir', '1998-06-12', ['Boxing', 'Gym & Fitness']);

  // Step 2: boxing experience and training basics. The AI box stays unticked.
  await expect(page).toHaveURL('/welcome/2');
  await page.getByRole('radio', { name: /A few classes/ }).check();
  await page.getByRole('checkbox', { name: 'Learn proper technique' }).check();
  await page.getByRole('radio', { name: '4', exact: true }).check({ force: true });
  await page.getByRole('checkbox', { name: 'Gloves and wraps' }).check();
  await page.getByRole('checkbox', { name: 'Skipping rope' }).check();
  await page.getByLabel(/Any injuries or limits/).fill('old left knee injury');
  await page.getByRole('button', { name: 'Continue' }).click();

  // Step 3: gym goal. Weight given, height left empty.
  await expect(page).toHaveURL('/welcome/3');
  await page.getByRole('radio', { name: /Build muscle/ }).check();
  await page.getByRole('radio', { name: 'Full gym' }).check({ force: true });
  await page.getByRole('radio', { name: 'Under 1 year' }).check({ force: true });
  await page.getByLabel('Weight (kg)').fill('72');
  await page.getByRole('button', { name: 'Continue' }).click();

  // Step 4: the summary shows the saved answers and links back to edit them.
  await expect(page).toHaveURL('/welcome/4');
  await expect(page.getByRole('heading', { name: 'You’re in, Kabir' })).toBeVisible();
  const summary = page.locator('dl');
  await expect(summary).toContainText('Boxing, Gym & Fitness');
  await expect(summary).toContainText('Build muscle, full gym');
  await expect(summary).toContainText('A few classes');
  await expect(summary).toContainText('Not shared');
  await expect(page.getByRole('link', { name: 'Change answers' })).toHaveAttribute('href', '/welcome/1');

  expect(await savedSignUp(email)).toEqual({
    prefs: [
      { category_id: 'boxing', answers: { experience: 'few_classes', wants: ['technique'] } },
      { category_id: 'gym', answers: { goal: 'muscle', place: 'full_gym', lifting: 'under_1' } },
    ],
    basics: { days_per_week: 4, equipment: ['gloves', 'rope'], injury_notes: 'old left knee injury' },
    // The unticked box is stored as an explicit no.
    consents: [{ purpose: 'ai_health_personalisation', granted: false }],
    metrics: [{ weight_kg: 72, height_cm: null }],
  });
});

test('boxing only skips the gym step, and a yes to AI use is stored', async ({ page }, testInfo) => {
  const email = `e2e-boxing-${testInfo.project.name}-${Date.now()}@test.fitsphere`;
  await signUp(page, email);
  await fillAboutYou(page, 'Ravi', '1995-01-20', ['Boxing']);
  await page.getByRole('radio', { name: /Brand new/ }).check();
  await page.getByRole('radio', { name: '3', exact: true }).check({ force: true });
  await page.getByRole('checkbox', { name: /Use this to personalise AI answers/ }).check();
  await page.getByRole('button', { name: 'Continue' }).click();

  await expect(page).toHaveURL('/welcome/4');
  await expect(page.locator('dl')).not.toContainText('Gym goal');
  await expect(page.locator('dl')).toContainText('Shared');
  const saved = await savedSignUp(email);
  expect(saved.consents).toEqual([{ purpose: 'ai_health_personalisation', granted: true }]);
  expect(saved.metrics).toEqual([]);
});

test('step 2 shows inline errors for the required answers', async ({ page }, testInfo) => {
  await signUp(page, `e2e-step2-${testInfo.project.name}-${Date.now()}@test.fitsphere`);
  await fillAboutYou(page, 'Kabir', '1998-06-12', ['Boxing']);
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByText('Pick your boxing experience')).toBeVisible();
  await expect(page.getByText('Pick how many days a week you can train')).toBeVisible();
});

test('a bad weight shows an error, and going back keeps the answers', async ({ page }, testInfo) => {
  await signUp(page, `e2e-step3-${testInfo.project.name}-${Date.now()}@test.fitsphere`);
  await fillAboutYou(page, 'Neha', '1996-03-03', ['Gym & Fitness']);
  await page.getByRole('radio', { name: '5', exact: true }).check({ force: true });
  await page.getByRole('button', { name: 'Continue' }).click();

  await page.getByRole('radio', { name: /Lose fat/ }).check();
  await page.getByRole('radio', { name: 'Bodyweight only' }).check({ force: true });
  await page.getByRole('radio', { name: 'New to it' }).check({ force: true });
  await page.getByLabel('Weight (kg)').fill('7');
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByText(/Enter weight in kg/)).toBeVisible();

  await page.getByLabel('Weight (kg)').fill('');
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page).toHaveURL('/welcome/4');

  // Back through the steps: every saved answer is filled in.
  await page.getByRole('link', { name: 'Change answers' }).click();
  await expect(page.getByLabel('First name')).toHaveValue('Neha');
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('radio', { name: '5', exact: true })).toBeChecked();
});

test('a later step without step 1 goes back to step 1', async ({ page }, testInfo) => {
  await signUp(page, `e2e-skip-${testInfo.project.name}-${Date.now()}@test.fitsphere`);
  await page.goto('/welcome/2');
  await expect(page).toHaveURL('/welcome/1');
});
