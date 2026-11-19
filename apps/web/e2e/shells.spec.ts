import { expect, test } from '@playwright/test';
import { signInAs } from './helpers';

const isPhone = (name: string) => name === 'phone';

test('a guest sees the public header; on a phone, the menu', async ({ page }, testInfo) => {
  await page.goto('/');
  const header = page.getByRole('navigation', { name: 'Main' });
  if (isPhone(testInfo.project.name)) {
    await expect(header.getByRole('link', { name: 'Join', exact: true })).toBeVisible();
    await header.getByRole('link', { name: 'Menu' }).click();
    await expect(page).toHaveURL('/menu');
    const menu = page.getByRole('navigation', { name: 'Menu' });
    for (const label of ['Learn', 'For coaches', 'Privacy', 'Terms']) {
      await expect(menu.getByRole('link', { name: label, exact: true })).toBeVisible();
    }
    await page.getByRole('link', { name: 'Close menu' }).click();
    await expect(page).toHaveURL('/');
  } else {
    for (const label of ['Learn', 'Coaches', 'For coaches']) await expect(header.getByRole('link', { name: label, exact: true })).toBeVisible();
    await expect(header.getByRole('link', { name: 'Join free' })).toBeVisible();
  }
});

test('a guest opening /today goes to sign-in', async ({ page }) => {
  await page.goto('/today');
  await expect(page).toHaveURL('/sign-in');
});

test('an athlete lands on Today with the athlete header, and bottom tabs on a phone', async ({ page }, testInfo) => {
  await signInAs(page, ['athlete'], { name: 'Kabir' });
  await expect(page).toHaveURL('/today');
  await expect(page.getByRole('heading', { name: 'Today' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Kabir, your account' })).toHaveText('K');

  const tabs = page.getByRole('navigation', { name: 'App' }).last();
  if (isPhone(testInfo.project.name)) {
    await expect(tabs.getByRole('link', { name: 'Today' })).toHaveAttribute('aria-current', 'page');
    for (const label of ['Learn', 'Progress']) await expect(tabs.getByRole('link', { name: label })).toBeVisible();
  } else {
    const header = page.getByRole('navigation', { name: 'App' }).first();
    await expect(header.getByRole('link', { name: 'Today' })).toHaveAttribute('aria-current', 'page');
    // Role queries skip hidden elements, so only the header counts: the tab bar is hidden on desktop.
    await expect(page.getByRole('navigation', { name: 'App' })).toHaveCount(1);
  }
});

test('an athlete opening /coach sees the not-allowed page', async ({ page }) => {
  await signInAs(page, ['athlete']);
  await page.goto('/coach');
  await expect(page).toHaveURL('/not-allowed');
  await expect(page.getByRole('heading', { name: 'Not for your account' })).toBeVisible();
});

test('an unfinished sign-up goes back to its next step', async ({ page, browser }) => {
  await signInAs(page, ['athlete'], { stepsDone: 0 });
  await expect(page).toHaveURL('/welcome/1');
  await page.goto('/today');
  await expect(page).toHaveURL('/welcome/1');

  // Someone who stopped after step 1 resumes at step 2, so the AI consent is always asked.
  const second = await (await browser.newContext()).newPage();
  await signInAs(second, ['athlete'], { stepsDone: 1 });
  await expect(second).toHaveURL('/welcome/2');
  await second.goto('/today');
  await expect(second).toHaveURL('/welcome/2');
});

test('an admin-only user lands on People and is offered no coach pages', async ({ page }, testInfo) => {
  test.skip(isPhone(testInfo.project.name), 'The admin links live in the desktop header.');
  await signInAs(page, ['admin']);
  await expect(page).toHaveURL('/admin/people');
  const header = page.getByRole('navigation', { name: 'Coach' }).first();
  await expect(header.getByRole('link', { name: 'People' })).toBeVisible();
  await expect(header.getByRole('link', { name: 'Athletes' })).toHaveCount(0);
  await expect(header.getByRole('link', { name: 'Athlete site' })).toBeVisible();
});

test('a coach lands on the coach dashboard with the coach header', async ({ page }, testInfo) => {
  await signInAs(page, ['coach']);
  await expect(page).toHaveURL('/coach');
  await expect(page.getByRole('heading', { name: 'Set up your camp' })).toBeVisible();
  const nav = page.getByRole('navigation', { name: 'Coach' });
  await expect(nav.first().getByText('Coach', { exact: true })).toBeVisible();
  if (isPhone(testInfo.project.name)) {
    const tabs = nav.last();
    for (const label of ['Athletes', 'Programs', 'Lessons']) await expect(tabs.getByRole('link', { name: label })).toBeVisible();
    await expect(tabs.getByRole('link', { name: 'Review' })).toHaveCount(0);
  } else {
    for (const label of ['Athletes', 'Programs', 'My lessons']) await expect(nav.first().getByRole('link', { name: label })).toBeVisible();
    await expect(nav.first().getByRole('link', { name: 'People' })).toHaveCount(0);
  }
  // A coach who is not an athlete cannot open athlete pages.
  await page.goto('/today');
  await expect(page).toHaveURL('/not-allowed');
});

test('an admin sees People and the athlete site link; others cannot open People', async ({ page, browser }, testInfo) => {
  test.skip(isPhone(testInfo.project.name), 'The admin links live in the desktop header.');
  await signInAs(page, ['athlete', 'coach', 'reviewer', 'admin']);
  await page.goto('/admin/people');
  const header = page.getByRole('navigation', { name: 'Coach' }).first();
  await expect(header.getByRole('link', { name: 'People' })).toHaveAttribute('aria-current', 'page');
  await expect(header.getByRole('link', { name: /Review queue/ })).toBeVisible();
  // This admin also trains, so the header offers "Train"; an admin who does not train gets "Athlete site".
  await expect(header.getByRole('link', { name: 'Train' })).toBeVisible();

  const coachPage = await (await browser.newContext()).newPage();
  await signInAs(coachPage, ['coach']);
  await coachPage.goto('/admin/people');
  await expect(coachPage).toHaveURL('/not-allowed');
});
