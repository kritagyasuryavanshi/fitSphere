import { expect, test } from '@playwright/test';
import { admin } from './helpers';

test.describe('lesson pages', () => {
  test('a boxing lesson shows steps, mistakes, safety, prerequisites and what to practise next', async ({ page }) => {
    await page.goto('/learn/boxing');
    await page.getByRole('region', { name: 'Boxing lessons' }).locator('a[href="/learn/boxing/jab"]').click();
    await expect(page.getByRole('heading', { level: 1, name: 'The Jab' })).toBeVisible();
    // Client navigation keeps the previous page hidden in the DOM, so match visible text only.
    await expect(page.getByText('Sample, awaiting a coach').filter({ visible: true })).toBeVisible();
    await expect(page.getByText('Coach-verified').filter({ visible: true })).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Step by step' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Common mistakes' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Safety' })).toBeVisible();
    await expect(page.getByRole('link', { name: /^Guard/ })).toBeVisible();
    await expect(page.getByRole('link', { name: /^The Cross/ })).toBeVisible();
  });

  test('a gym exercise shows its muscles and the rep range per goal', async ({ page }) => {
    await page.goto('/learn/gym/barbell-bench-press');
    await expect(page.getByRole('heading', { level: 1, name: 'Barbell bench press' })).toBeVisible();
    await expect(page.getByText('Front shoulders')).toBeVisible();
    const table = page.getByRole('table');
    await expect(table.getByRole('row', { name: /Build muscle 8-12/ })).toBeVisible();
    await expect(table.getByRole('row')).toHaveCount(4);
    await expect(page.getByRole('link', { name: /^Push-up/ })).toBeVisible();
  });

  test('a draft URL is not found, and a slug under the wrong category is not found', async ({ page }) => {
    const db = admin();
    const { data: discipline } = await db.from('disciplines').select('id').eq('category_id', 'boxing').eq('slug', 'defence').single();
    const slug = `draft-${test.info().project.name}-${Date.now()}`;
    const { error } = await db.from('content_items').insert({ discipline_id: discipline!.id, kind: 'skill', slug, title: 'Secret draft', status: 'draft' });
    expect(error).toBeNull();
    for (const path of [`/learn/boxing/${slug}`, '/learn/gym/jab']) {
      await page.goto(path);
      await expect(page.getByRole('heading', { name: 'This page could not be found.' })).toBeVisible();
      await expect(page.getByText('Secret draft')).toHaveCount(0);
    }
    await db.from('content_items').delete().eq('slug', slug);
  });

  test('the video loads from youtube-nocookie only after a tap', async ({ page }) => {
    const db = admin();
    // One item per project, so the phone and desktop runs do not race on the same row.
    const slug = test.info().project.name === 'phone' ? 'parry' : 'slip';
    await db.from('content_items').update({ video_id: 'dQw4w9WgXcQ' }).eq('slug', slug);
    try {
      await page.goto(`/learn/boxing/${slug}`);
      await expect(page.locator('iframe')).toHaveCount(0);
      await page.getByRole('button', { name: /Play the video/ }).click();
      await expect(page.locator('iframe')).toHaveAttribute('src', /^https:\/\/www\.youtube-nocookie\.com\/embed\/dQw4w9WgXcQ/);
    } finally {
      await db.from('content_items').update({ video_id: null }).eq('slug', slug);
    }
  });
});
