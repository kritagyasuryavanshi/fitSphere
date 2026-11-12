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

for (const [email, role] of seededUsers) {
  test(`seeded ${role} ${email} can sign in`, async ({}, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'An API check; one viewport is enough.');
    const db = createDbClient(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '', process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '');
    const { data, error } = await db.auth.signInWithPassword({ email, password: 'password123' });
    expect(error).toBeNull();
    const { data: roles } = await db.from('user_roles').select('role').eq('user_id', data.user!.id);
    expect(roles?.map((r) => r.role)).toContain(role);
  });
}
