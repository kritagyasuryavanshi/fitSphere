import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { admin, signInAs, userIdByEmail } from './helpers';

test('a consent switch takes effect at once and each change is logged', async ({ page }) => {
  const email = await signInAs(page, ['athlete']);
  await page.goto('/account');
  const notes = page.getByRole('switch', { name: 'Use my injury notes in AI answers' });
  await expect(notes).toHaveAttribute('aria-checked', 'false');

  await notes.click();
  await expect(notes).toHaveAttribute('aria-checked', 'true');
  await notes.click();
  await expect(notes).toHaveAttribute('aria-checked', 'false');

  const { data } = await admin().from('consents').select('granted').eq('user_id', await userIdByEmail(email)).eq('purpose', 'ai_health_personalisation').order('created_at');
  expect(data?.map((r) => r.granted)).toEqual([true, false]);
});

test('download gives a JSON file of the person’s own data', async ({ page }) => {
  const email = await signInAs(page, ['athlete'], { name: 'Kabir' });
  await page.goto('/account');
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('link', { name: 'Download my data' }).click()]);
  expect(download.suggestedFilename()).toMatch(/^fitsphere-data-.*\.json$/);
  const data = JSON.parse(await readFile(await download.path(), 'utf8'));
  expect(data.email).toBe(email);
  expect(data.profile.display_name).toBe('Kabir');
  expect(data.roles).toEqual(['athlete']);
});

test('delete needs the confirm screen, then removes the account', async ({ page }) => {
  const email = await signInAs(page, ['athlete']);
  const id = await userIdByEmail(email);
  await page.goto('/account');
  await page.getByRole('link', { name: 'Delete account' }).click();
  await expect(page).toHaveURL('/account/delete');
  await expect(page.getByRole('alertdialog', { name: 'Delete your account?' })).toBeVisible();

  // Keeping the account changes nothing.
  await page.getByRole('link', { name: 'Keep my account' }).click();
  await expect(page).toHaveURL('/account');
  expect(await userIdByEmail(email)).toBe(id);

  await page.goto('/account/delete');
  await page.getByRole('button', { name: 'Delete my account' }).click();
  await expect(page).toHaveURL('/?deleted=1');
  expect(await userIdByEmail(email)).toBe('');
  const { count } = await admin().from('profiles').select('id', { count: 'exact', head: true }).eq('id', id);
  expect(count).toBe(0);

  // The session is gone too.
  await page.goto('/account');
  await expect(page).toHaveURL('/sign-in');
});

test('an admin cannot delete their own account', async ({ page }) => {
  const email = await signInAs(page, ['athlete', 'admin']);
  await page.goto('/account/delete');
  await page.getByRole('button', { name: 'Delete my account' }).click();
  await expect(page.getByText(/Ask another admin to remove your admin role first/)).toBeVisible();
  expect(await userIdByEmail(email)).not.toBe('');
});

test('the first name can be changed, and a guest cannot open the account page', async ({ page, browser }) => {
  await signInAs(page, ['athlete'], { name: 'Kabir' });
  await page.goto('/account');
  await page.getByLabel('First name').fill('Kabir S');
  await page.getByRole('button', { name: 'Save name' }).click();
  await expect(page.getByText('Saved.')).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('First name')).toHaveValue('Kabir S');

  const guest = await (await browser.newContext()).newPage();
  await guest.goto('/account');
  await expect(guest).toHaveURL('/sign-in');
});

test('someone who stopped at step 1 can still download and delete, and log out', async ({ page }) => {
  const email = await signInAs(page, ['athlete'], { stepsDone: 0 });
  await page.goto('/account');
  await expect(page).toHaveURL('/account');
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('link', { name: 'Download my data' }).click()]);
  expect(JSON.parse(await readFile(await download.path(), 'utf8')).email).toBe(email);
  await page.goto('/account/delete');
  await page.getByRole('button', { name: 'Delete my account' }).click();
  await expect(page).toHaveURL('/?deleted=1');
  await expect(page.getByText('Your account and everything personal in it have been deleted.')).toBeVisible();
  expect(await userIdByEmail(email)).toBe('');
});

test('a coach-only person can open the account page', async ({ page }) => {
  await signInAs(page, ['coach']);
  await page.goto('/account');
  await expect(page.getByRole('heading', { name: 'Account' })).toBeVisible();
  await page.getByRole('button', { name: 'Log out' }).click();
  await expect(page).toHaveURL('/');
  await page.goto('/account');
  await expect(page).toHaveURL('/sign-in');
});
