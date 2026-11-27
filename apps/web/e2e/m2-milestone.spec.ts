import { expect, test } from '@playwright/test';
import { admin, signInAs } from './helpers';

// The design doc's M2 Verify line, as one journey (M2-11).
test('M2: browse to the jab, filter drills, save and complete, drafts 404, search jab, samples say Sample', async ({ page }) => {
  await signInAs(page, ['athlete']);

  // Boxing > Technical Boxing > Jab > lesson.
  await page.goto('/learn/boxing?discipline=technical');
  const tiles = page.getByRole('region', { name: 'Boxing lessons' }).locator('a[href^="/learn/boxing/"]');
  await page.getByRole('region', { name: 'Boxing lessons' }).locator('a[href="/learn/boxing/jab"]').click();
  await expect(page.getByRole('heading', { level: 1, name: 'The Jab' })).toBeVisible();
  await expect(page.getByText('Sample, awaiting a coach').filter({ visible: true })).toBeVisible();
  await expect(page.getByText('Coach-verified').filter({ visible: true })).toHaveCount(0);

  // Save and complete; both persist after reload.
  await page.getByRole('button', { name: 'Mark complete' }).click();
  await expect(page.getByRole('button', { name: 'Completed ✓' })).toBeVisible();
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Saved' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Completed ✓' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Saved' })).toBeVisible();

  // Filter drills by equipment.
  await page.goto('/learn/boxing?equipment=heavy_bag');
  await expect(tiles).toHaveCount(1);
  await expect(tiles.first()).toContainText('Heavy bag rhythm');

  // A draft lesson is not public.
  const db = admin();
  const { data: discipline } = await db.from('disciplines').select('id').eq('category_id', 'boxing').eq('slug', 'technical').single();
  const slug = `m2-draft-${test.info().project.name}-${Date.now()}`;
  await db.from('content_items').insert({ discipline_id: discipline!.id, kind: 'skill', slug, title: 'Unreleased', status: 'draft' });
  await page.goto(`/learn/boxing/${slug}`);
  await expect(page.getByRole('heading', { name: 'Page not found.' })).toBeVisible();
  await db.from('content_items').delete().eq('slug', slug);

  // Search for "jab" returns the jab skill first, and its drills.
  await page.goto('/search?q=jab');
  const results = page.getByRole('list', { name: 'Results' }).getByRole('link');
  await expect(results.first()).toContainText('The Jab');
  await expect(results.filter({ hasText: /^Drill/ }).first()).toBeVisible();
});
