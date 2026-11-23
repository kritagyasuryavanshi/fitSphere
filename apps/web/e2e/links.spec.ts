import { expect, test } from '@playwright/test';

// Regression: the header, menu and sign-in page linked to pages that did not exist (/programs, /coaches, /ask, /help,
// /about, /legal/*). Found by /qa on 2026-11-19 (M3-15). Every internal link on the public pages must open.
test('public pages link only to pages that exist', async ({ page, request }) => {
  const hrefs = new Set<string>();
  for (const path of ['/', '/learn', '/learn/boxing', '/search', '/for-coaches', '/sign-in', '/menu', '/legal/privacy', '/legal/terms', '/about', '/help', '/programs']) {
    const res = await page.goto(path);
    expect(res?.status(), path).toBeLessThan(400);
    for (const href of await page.$$eval('a[href^="/"]', (as) => as.map((a) => a.getAttribute('href') ?? ''))) hrefs.add(href.split('#')[0]!);
  }
  for (const href of hrefs) {
    const res = await request.get(href);
    expect(res.status(), href).toBeLessThan(400);
  }
});

test('the legal pages name each section for screen readers', async ({ page }) => {
  await page.goto('/legal/privacy');
  await expect(page.getByRole('region', { name: 'Who sees it' })).toContainText('stops once you have left all of that coach');
  await page.goto('/legal/terms');
  await expect(page.getByRole('region', { name: 'Train safely' })).toBeVisible();
});

test('the legal pages are a marked draft with the beta rules (M6-02a)', async ({ page }) => {
  await page.goto('/legal/privacy');
  await expect(page.getByRole('note')).toContainText('Draft');
  await expect(page.getByRole('region', { name: 'Who we are' })).toContainText('18 or older');
  for (const name of ['Service providers', 'How long we keep it', 'Your consent and how to withdraw it', 'Questions and complaints', 'If something goes wrong'])
    await expect(page.getByRole('region', { name })).toBeVisible();
  await page.goto('/legal/terms');
  await expect(page.getByRole('note')).toContainText('Draft');
  await expect(page.getByRole('region', { name: 'Who can use it' })).toContainText('18 or older');
});
