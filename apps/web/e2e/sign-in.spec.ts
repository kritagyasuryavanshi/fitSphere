import { expect, test } from '@playwright/test';
import { createDbClient } from '@fitsphere/db';
import { accountState, signInLink } from './helpers';

test('a malformed email shows the inline error from the mockup', async ({ page }) => {
  await page.goto('/sign-in');
  await page.getByLabel('Email').fill('kabir@example');
  await page.getByRole('button', { name: 'Email me a link' }).click();
  await expect(page.getByText('Enter a full email address, like kabir@example.com')).toBeVisible();
  await expect(page.getByLabel('Email')).toHaveAttribute('aria-invalid', 'true');
  await expect(page.getByLabel('Email')).toHaveValue('kabir@example');
});

test('the email link from the local inbox signs the user in', async ({ page }, testInfo) => {
  const email = `e2e-${testInfo.project.name}-${Date.now()}@test.fitsphere`;
  await page.goto('/sign-in');
  await page.getByLabel('Email').fill(email);
  await page.getByRole('button', { name: 'Email me a link' }).click();

  await expect(page.getByRole('heading', { name: 'Check your email' })).toBeVisible();
  await expect(page.getByText(email)).toBeVisible();
  // Typing an address proves nothing: no confirmed account and no profile until the link is clicked.
  expect(await accountState(email)).toEqual({ exists: true, confirmed: false, profiles: 0 });

  await page.goto(await signInLink(email));
  // A new user starts sign-up at step 1, signed in.
  await expect(page).toHaveURL('/welcome/1');
  await expect(page.getByRole('heading', { name: 'About you' })).toBeVisible();
  expect(await accountState(email)).toEqual({ exists: true, confirmed: true, profiles: 1 });
});

test('resend stays disabled for 60 seconds', async ({ page }) => {
  await page.clock.install();
  await page.goto('/check-email?email=kabir%40example.com');
  const resend = page.getByRole('button', { name: /^Resend link/ });
  await expect(resend).toBeDisabled();
  await expect(resend).toHaveText('Resend link in 1:00');

  // The button streams in behind Suspense, so its clock starts late. Tick until it moves, then read where it is.
  await expect(async () => {
    await page.clock.runFor(250);
    await expect(resend).not.toHaveText('Resend link in 1:00', { timeout: 500 });
  }).toPass();
  const left = Number((await resend.textContent())?.match(/0:(\d\d)$/)?.[1]);
  expect(left).toBeGreaterThan(1);

  await page.clock.runFor((left - 1) * 1_000);
  await expect(resend).toHaveText('Resend link in 0:01');
  await expect(resend).toBeDisabled();
  await page.clock.runFor(1_000);
  await expect(resend).toBeEnabled();
  await expect(resend).toHaveText('Resend link');
});

test('a used or expired link sends the user back with a message', async ({ page }) => {
  await page.goto('/auth/callback?code=not-a-real-code');
  await expect(page).toHaveURL(/\/sign-in\?error=link$/);
  await expect(page.getByText('That link has expired, was already used, or was opened in a different browser.', { exact: false })).toBeVisible();
});

test('a failed Google sign-in says so', async ({ page }) => {
  await page.goto('/auth/callback?error=access_denied&error_description=cancelled');
  await expect(page).toHaveURL(/\/sign-in\?error=google$/);
  await expect(page.getByText('Google sign-in did not work. Try again, or use your email.')).toBeVisible();
});

test('an unknown error code in the URL is ignored', async ({ page }) => {
  await page.goto('/sign-in?error=constructor');
  await expect(page.getByRole('heading', { name: 'Log in or join' })).toBeVisible();
});

test('the check-email page without an address goes back to sign-in', async ({ page }) => {
  await page.goto('/check-email');
  await expect(page).toHaveURL('/sign-in');
});

test('a password planted before the owner confirms does not work after', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'An auth check; one viewport is enough.');
  const email = `e2e-planted-${Date.now()}@test.fitsphere`;
  const anon = createDbClient(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '', process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '');
  const { data } = await anon.auth.signUp({ email, password: 'attacker-pass-123' });
  expect(data.session).toBeNull();

  // The real owner clicks the confirmation link from their inbox.
  await page.goto(await signInLink(email));
  expect(await accountState(email)).toMatchObject({ confirmed: true, profiles: 1 });

  const { error } = await anon.auth.signInWithPassword({ email, password: 'attacker-pass-123' });
  expect(error).not.toBeNull();
});
