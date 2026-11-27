import { expect, test } from '@playwright/test';
import { createDbClient } from '@fitsphere/db';

const seededUsers = [
  ['athlete@test.fitsphere', 'athlete'],
  ['coach1@test.fitsphere', 'coach'],
  ['coach2@test.fitsphere', 'coach'],
  ['reviewer@test.fitsphere', 'reviewer'],
  ['admin@test.fitsphere', 'admin'],
] as const;

test('home page shows real lessons and no placeholder', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: 'Learn it. Train it. Get stronger.' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Start training free' }).first()).toHaveAttribute('href', '/sign-in');
  // Every live sport is an equal path with its real count; cricket is named only as planned.
  const paths = page.getByRole('region', { name: 'Three ways to train' });
  for (const [href, noun] of [['/learn/boxing', 'lessons'], ['/learn/sc', 'exercises'], ['/learn/gym', 'exercises']])
    await expect(paths.locator(`a[href="${href}"]`)).toContainText(new RegExp(`\\d+ ${noun}`));
  await expect(paths.getByText('Planned, not on FitSphere yet: Cricket.')).toBeVisible();
  // The boxing rail lists published lessons from the database, with their real count.
  const rail = page.getByRole('region', { name: 'Boxing fundamentals' });
  await expect(rail.getByRole('link', { name: /^All \d+ boxing lessons$/ })).toBeVisible();
  await expect(rail.getByRole('listitem').first()).toBeVisible();
  await expect(page.getByText('App scaffold')).toHaveCount(0);
  await expect(page.getByRole('contentinfo').getByRole('link', { name: 'Help' })).toHaveAttribute('href', '/help');
});

test('about, help and programs pages render', async ({ page }) => {
  await page.goto('/about');
  await expect(page.getByRole('heading', { level: 1, name: /One place to learn/ })).toBeVisible();
  await page.goto('/help');
  await expect(page.getByRole('region', { name: 'Getting started' })).toContainText('18');
  await page.goto('/programs');
  await expect(page.getByRole('region', { name: 'How joining works' })).toBeVisible();
});

test('every page refuses to load in a frame on another site', async ({ request }) => {
  for (const path of ['/', '/account/delete']) {
    const h = (await request.get(path, { maxRedirects: 0 })).headers();
    expect(h['x-frame-options']).toBe('DENY');
    expect(h['content-security-policy']).toContain("frame-ancestors 'none'");
    expect(h['x-content-type-options']).toBe('nosniff');
    expect(h['referrer-policy']).toBe('strict-origin-when-cross-origin');
  }
});

test('an unknown URL shows the designed 404 page with a 404 status', async ({ page }) => {
  const res = await page.goto('/no-such-page');
  expect(res?.status()).toBe(404);
  await expect(page.getByRole('heading', { level: 1, name: 'Page not found.' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Browse lessons' })).toHaveAttribute('href', '/learn');
});

test('the styleguide is hidden in a production build', async ({ page }) => {
  await page.goto('/styleguide');
  await expect(page.getByRole('heading', { level: 1, name: 'Page not found.' })).toBeVisible();
});

for (const [email, role] of seededUsers) {
  test(`seeded ${role} ${email} can sign in`, async ({}, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'An API check; one viewport is enough.');
    const db = createDbClient(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '', process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '');
    const { data, error } = await db.auth.signInWithPassword({ email, password: 'password123' });
    expect(error).toBeNull();
    const { data: roles, error: rolesError } = await db.from('user_roles').select('role').eq('user_id', data.user!.id);
    expect(rolesError).toBeNull();
    expect(roles?.map((r) => r.role)).toContain(role);
  });
}

test('the job health check refuses a caller without the cron secret (M6-12)', async ({ request }) => {
  expect((await request.get('/api/health/jobs')).status()).toBe(401);
  expect((await request.get('/api/health/jobs', { headers: { authorization: 'Bearer guess' } })).status()).toBe(401);
});

test('the app can be installed: a manifest with icons that load (M6-04)', async ({ request }) => {
  const manifest = await (await request.get('/manifest.webmanifest')).json();
  expect(manifest.display).toBe('standalone');
  for (const icon of manifest.icons as { src: string }[]) {
    const res = await request.get(icon.src);
    expect(res.status(), icon.src).toBe(200);
    expect(res.headers()['content-type']).toBe('image/png');
  }
  expect((await request.get('/apple-icon')).headers()['content-type']).toContain('image/png');
});
