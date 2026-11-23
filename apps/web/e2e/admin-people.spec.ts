import { expect, test } from '@playwright/test';
import { admin, createUser, signInAs } from './helpers';

test.skip(({ isMobile }) => isMobile, 'An admin screen; desktop is enough.');

async function rolesOf(id: string) {
  const { data } = await admin().from('user_roles').select('role').eq('user_id', id).order('role');
  return data?.map((r) => r.role);
}

test('an admin finds a person, makes them a coach, and the change is audited', async ({ page }) => {
  const target = await createUser(['athlete'], { name: 'Meera' });
  await signInAs(page, ['admin'], { name: 'Asha' });
  await expect(page).toHaveURL('/admin/people');

  await page.getByLabel('Search people').fill(target.email);
  await page.getByLabel('Search people').press('Enter');
  await expect(page).toHaveURL(/q=/);
  const row = page.getByRole('row').filter({ hasText: target.email });
  await expect(row).toHaveCount(1);

  await row.getByRole('group', { name: 'Roles for Meera' }).getByLabel('Coach').check();
  await page.getByRole('button', { name: 'Save role changes' }).click();
  await expect(page.getByText('Saved role changes for 1 person.')).toBeVisible();

  expect(await rolesOf(target.id)).toEqual(['athlete', 'coach']);
  const { data: audit } = await admin().from('audit_log').select('action, details').eq('target_id', target.id).eq('action', 'role_granted').order('id');
  expect(audit?.at(-1)).toEqual({ action: 'role_granted', details: { role: 'coach' } });
  // After the save the box shows what the database holds.
  await expect(row.getByLabel('Coach')).toBeChecked();
});

test('saving from the full list, which holds the own row of the admin, shows no false error', async ({ page }) => {
  // Unique names: earlier runs leave other people in the local database.
  const tag = Date.now().toString(36);
  const target = await createUser(['athlete'], { name: `Ritu ${tag}` });
  await signInAs(page, ['admin'], { name: `Asha ${tag}` });
  await expect(page.getByRole('group', { name: `Roles for Asha ${tag}` })).toBeVisible();
  await page.getByRole('group', { name: `Roles for Ritu ${tag}` }).getByLabel('Reviewer').check();
  await page.getByRole('button', { name: 'Save role changes' }).click();
  await expect(page.getByText('Saved role changes for 1 person.')).toBeVisible();
  await expect(page.getByText(/cannot change the roles/)).toHaveCount(0);
  expect(await rolesOf(target.id)).toEqual(['athlete', 'reviewer']);
});

test('a save from a stale page does not undo another admin', async ({ page }) => {
  const target = await createUser(['athlete'], { name: 'Sana' });
  await signInAs(page, ['admin'], { name: 'Asha' });
  await page.goto(`/admin/people?q=${encodeURIComponent(target.email)}`);
  // Another admin grants coach while this page is open.
  await admin().from('user_roles').insert({ user_id: target.id, role: 'coach' });

  await page.getByRole('group', { name: 'Roles for Sana' }).getByLabel('Reviewer').check();
  await page.getByRole('button', { name: 'Save role changes' }).click();
  await expect(page.getByText(/The roles of Sana changed since you opened this page/)).toBeVisible();
  expect(await rolesOf(target.id)).toEqual(['athlete', 'coach']);
});

test('an admin cannot change their own roles', async ({ page }) => {
  const email = await signInAs(page, ['admin'], { name: 'Asha' });
  await page.goto(`/admin/people?q=${encodeURIComponent(email)}`);
  const own = page.getByRole('group', { name: 'Roles for Asha' });
  await expect(own.getByLabel('Admin')).toBeChecked();
  await expect(own.getByLabel('Admin')).toBeDisabled();
});

test('only an admin sees the page', async ({ page }) => {
  await signInAs(page, ['athlete', 'coach', 'reviewer']);
  await page.goto('/admin/people');
  await expect(page).toHaveURL('/not-allowed');
});

test('an admin invites an address to the beta, and the invite is stored lower case (M6-15)', async ({ page }) => {
  await signInAs(page, ['admin'], { name: 'Asha' });
  await page.goto('/admin/people');
  const address = `Beta.${Date.now()}@T.test`;
  await page.getByLabel('Email address').fill(address);
  await page.getByRole('button', { name: 'Invite', exact: true }).click();
  await expect(page.getByRole('status')).toContainText(`${address.toLowerCase()} can now sign up.`);
  const { data } = await admin().from('beta_invites').select('email').eq('email', address.toLowerCase());
  expect(data).toHaveLength(1);
});

test('the not-invited screen says why and offers deletion (M6-15)', async ({ page }) => {
  await page.goto('/welcome/not-invited');
  await expect(page.getByRole('heading', { name: 'FitSphere is invite only for now' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Delete my account' })).toHaveAttribute('href', '/account/delete');
});
