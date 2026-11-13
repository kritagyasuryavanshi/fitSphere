import { expect, test, type Page } from '@playwright/test';
import { admin, signInAs, signInWithEmail } from './helpers';

test.skip(({ isMobile }) => isMobile, 'The admin side is desktop; one viewport is enough.');

async function apply(page: Page) {
  await page.goto('/for-coaches');
  await page.getByLabel('What you coach').selectOption('boxing');
  await page.getByLabel('City').fill('Kochi');
  await page.getByLabel('Years coaching').fill('6');
  await page.getByLabel('Link to your work').fill('https://youtube.com/@meeraboxing');
  await page.getByLabel(/How do you send programs/).fill('WhatsApp and a Google Sheet.');
  await page.getByLabel('I agree to the terms.').check();
  await page.getByRole('button', { name: 'Send application' }).click();
  await expect(page).toHaveURL('/for-coaches/applied');
}

async function outbox(email: string) {
  const { data } = await admin().from('email_outbox').select('template, data').eq('to_email', email);
  return data;
}

test('an applicant applies, the admin makes them a coach, and they get coach tools', async ({ page, browser }) => {
  const name = `Meera ${Date.now().toString(36)}`;
  const email = await signInAs(page, ['athlete'], { name });
  await apply(page);

  const adminPage = await (await browser.newContext()).newPage();
  await signInAs(adminPage, ['admin']);
  const card = adminPage.getByRole('article', { name: `Application from ${name}` });
  await expect(card).toContainText('6 years coaching, self-reported');
  // The account email shows, so a copied name cannot fool the admin.
  await expect(card).toContainText(email);
  await card.getByRole('button', { name: 'Make coach' }).click();
  await expect(card).toHaveCount(0);
  expect(await outbox(email)).toEqual([{ template: 'coach_approved', data: { name } }]);

  // The next page load shows the coach header.
  await page.goto('/coach');
  await expect(page.getByRole('navigation', { name: 'Coach' }).first().getByText('Coach', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Set up your camp' })).toBeVisible();
  // The new coach can move between both sides.
  await page.getByRole('link', { name: 'Train' }).click();
  await expect(page).toHaveURL('/today');
  await page.getByRole('link', { name: 'Coach tools' }).click();
  await expect(page).toHaveURL('/coach');

  // Signing in again lands the new coach on the first-run screen.
  const again = await (await browser.newContext()).newPage();
  await signInWithEmail(again, email);
  await expect(again).toHaveURL('/coach');
});

test('a declined applicant gets the decline email and no coach role', async ({ page, browser }) => {
  const name = `Ravi ${Date.now().toString(36)}`;
  const email = await signInAs(page, ['athlete'], { name });
  await apply(page);

  const adminPage = await (await browser.newContext()).newPage();
  await signInAs(adminPage, ['admin']);
  await adminPage.getByRole('article', { name: `Application from ${name}` }).getByRole('button', { name: 'Decline' }).click();
  await expect(adminPage.getByRole('article', { name: `Application from ${name}` })).toHaveCount(0);

  expect(await outbox(email)).toEqual([{ template: 'coach_declined', data: { name } }]);
  await page.goto('/coach');
  await expect(page).toHaveURL('/not-allowed');
});

test('a guest is asked to log in before applying; experience is marked self-reported', async ({ page }) => {
  await page.goto('/for-coaches');
  await expect(page.getByRole('link', { name: 'Log in or join to apply' })).toBeVisible();
  await signInAs(page, ['athlete']);
  await page.goto('/for-coaches');
  await expect(page.getByText('Shown as self-reported.')).toBeVisible();
});
