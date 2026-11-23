import { expect, test } from '@playwright/test';
import { createDbClient } from '@fitsphere/db';

const seededUsers = [
  ['athlete@test.fitsphere', 'athlete'],
  ['coach1@test.fitsphere', 'coach'],
  ['coach2@test.fitsphere', 'coach'],
  ['reviewer@test.fitsphere', 'reviewer'],
  ['admin@test.fitsphere', 'admin'],
] as const;

test('home page renders', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: 'FitSphere' })).toBeVisible();
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
  await expect(page.getByRole('heading', { level: 1, name: 'Out of the ring.' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Browse lessons' })).toHaveAttribute('href', '/learn');
});

test('the styleguide is hidden in a production build', async ({ page }) => {
  await page.goto('/styleguide');
  await expect(page.getByRole('heading', { level: 1, name: 'Out of the ring.' })).toBeVisible();
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
