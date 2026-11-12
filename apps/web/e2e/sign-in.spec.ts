import { expect, test } from '@playwright/test';

// The local Supabase stack catches every email in Mailpit.
const MAILPIT = process.env.MAILPIT_URL ?? 'http://127.0.0.1:54324';

async function signInLink(email: string): Promise<string> {
  let id: string | undefined;
  await expect
    .poll(async () => {
      const res = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:"${email}"`)}`);
      id = (await res.json()).messages?.[0]?.ID;
      return id;
    }, { timeout: 15_000 })
    .toBeTruthy();
  const message = await (await fetch(`${MAILPIT}/api/v1/message/${id}`)).json();
  const link = String(message.HTML ?? message.Text).match(/https?:\/\/[^\s"'<>]+\/auth\/v1\/verify[^\s"'<>]+/)?.[0];
  if (!link) throw new Error(`No sign-in link in the email to ${email}`);
  return link.replaceAll('&amp;', '&');
}

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

  await page.goto(await signInLink(email));
  await expect(page).toHaveURL('/');
  await expect(page.getByText(`Signed in as ${email}`)).toBeVisible();
});

test('resend stays disabled for 60 seconds', async ({ page }) => {
  await page.clock.install();
  await page.goto('/check-email?email=kabir%40example.com');
  const resend = page.getByRole('button', { name: /^Resend link/ });
  await expect(resend).toBeDisabled();
  await expect(resend).toHaveText('Resend link in 1:00');

  await page.clock.runFor(59_000);
  await expect(resend).toBeDisabled();
  await page.clock.runFor(1_000);
  await expect(resend).toBeEnabled();
  await expect(resend).toHaveText('Resend link');
});

test('a used or expired link sends the user back with a message', async ({ page }) => {
  await page.goto('/auth/callback?code=not-a-real-code');
  await expect(page).toHaveURL(/\/sign-in\?error=link$/);
  await expect(page.getByText('That link has expired or was already used. Send a new one.')).toBeVisible();
});

test('the check-email page without an address goes back to sign-in', async ({ page }) => {
  await page.goto('/check-email');
  await expect(page).toHaveURL('/sign-in');
});
