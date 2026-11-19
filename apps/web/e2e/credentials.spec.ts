import { expect, test, type Page } from '@playwright/test';
import { createUser, newPage, signInWithEmail } from './helpers';

const pdf = (name: string) => ({ name, mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4\n% test certificate\n%%EOF\n') });

async function upload(page: Page, title: string) {
  const form = page.getByRole('form', { name: 'Add a credential' });
  await form.getByLabel('Title').fill(title);
  await form.getByLabel('Issuer').fill('AIBA');
  await form.getByLabel('Certificate file (PDF, JPG or PNG, up to 10 MB)').setInputFiles(pdf('cert.pdf'));
  await form.getByRole('button', { name: 'Send for checking' }).click();
  await expect(form.getByText(`Sent for checking: ${title}.`)).toBeVisible();
}

test.describe('Credential checks', () => {
  test('a coach uploads, an admin rejects with a note and then checks, and the badge appears', async ({ page, browser }) => {
    const coach = await createUser(['athlete', 'coach'], { name: 'Vikram' });
    const admin = await createUser(['athlete', 'admin'], { name: 'Asha' });

    await signInWithEmail(page, coach.email);
    await page.goto('/coach/credentials');
    await upload(page, 'AIBA level 1 coach');
    const mine = page.getByRole('list', { name: 'Your credentials' });
    await expect(mine.getByRole('listitem').first()).toContainText('Waiting for a check');

    // The admin rejects it: first without a note, which is refused.
    const adminPage = await newPage(browser);
    await signInWithEmail(adminPage, admin.email);
    await adminPage.goto('/admin/credentials');
    const item = adminPage.getByRole('list', { name: 'Pending credentials' }).getByRole('listitem').filter({ hasText: 'AIBA level 1 coach' });
    await expect(item).toContainText('Issuer: AIBA');
    await expect(item.getByRole('link', { name: /Open document/ })).toHaveAttribute('href', /token=/);
    await item.getByRole('button', { name: 'Reject with note' }).click();
    await expect(item.getByText('Write a note the coach will see: what is wrong and what to upload instead.')).toBeVisible();
    await item.getByLabel('Note for the coach (needed to reject)').fill('The scan is cut off. Upload the full page.');
    await item.getByRole('button', { name: 'Reject with note' }).click();
    await expect(adminPage.getByText('No credentials are waiting for a check.')).toBeVisible();

    // The coach sees why, and uploads again.
    await page.reload();
    await expect(mine.getByRole('listitem').first()).toContainText('Not accepted');
    await expect(mine.getByRole('listitem').first()).toContainText('Why: The scan is cut off. Upload the full page.');
    await expect(page.getByText('Credentials checked')).toHaveCount(0);
    await upload(page, 'AIBA level 1 coach, full page');

    // The admin marks it checked; the coach now has the badge.
    await adminPage.reload();
    await adminPage.getByRole('list', { name: 'Pending credentials' }).getByRole('listitem').first().getByRole('button', { name: 'Mark checked' }).click();
    await expect(adminPage.getByText('No credentials are waiting for a check.')).toBeVisible();
    await page.reload();
    await expect(page.getByText('Credentials checked')).toBeVisible();
  });
});
