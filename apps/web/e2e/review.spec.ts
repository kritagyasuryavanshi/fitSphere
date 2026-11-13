import { expect, test } from '@playwright/test';
import { admin, createUser, signInWithEmail, userIdByEmail } from './helpers';

// A lesson waiting in review, written by the given user.
async function submitted(authorEmail: string, title: string) {
  const db = admin();
  const slug = `${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  const { data: discipline } = await db.from('disciplines').select('id').eq('category_id', 'boxing').eq('slug', 'defence').single();
  const { data: item, error } = await db
    .from('content_items')
    .insert({ discipline_id: discipline!.id, author_id: await userIdByEmail(authorEmail), kind: 'skill', slug, title, video_id: 'dQw4w9WgXcQ', mistakes: 'Reaching out.', safety: 'Go slow.', status: 'in_review' })
    .select('id')
    .single();
  expect(error).toBeNull();
  await db.from('content_steps').insert([1, 2, 3].map((position) => ({ item_id: item!.id, position, body: `Step ${position}.` })));
  return { id: item!.id, slug };
}

test.describe('review queue', () => {
  test('a reviewer sends one lesson back with a note, and publishes another', async ({ page }) => {
    const coach = await createUser(['athlete', 'coach'], { name: 'Vikram' });
    const back = await submitted(coach.email, 'Catching the jab');
    const live = await submitted(coach.email, 'Pull counter');
    const reviewer = await createUser(['reviewer'], { name: 'Rohan' });
    await signInWithEmail(page, reviewer.email);
    await expect(page).toHaveURL(/\/review$/);

    await page.locator(`a[href="/review/${back.id}"]`).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Catching the jab' })).toBeVisible();
    await page.getByRole('button', { name: 'Send back with note' }).click();
    await expect(page.getByText('Write a note so the coach knows what to change.')).toBeVisible();
    await page.getByLabel('Note to Vikram').fill('Show the block from the side.');
    await page.getByRole('button', { name: 'Send back with note' }).click();
    await expect(page.getByRole('status')).toContainText('Sent back');

    await page.locator(`a[href="/review/${live.id}"]`).click();
    const approve = page.getByRole('button', { name: 'Approve and publish' });
    await expect(approve).toBeDisabled();
    const checks = page.getByRole('group', { name: 'Your checks' }).getByRole('checkbox');
    for (let i = 0; i < 4; i++) await checks.nth(i).check();
    await expect(approve).toBeDisabled();
    await checks.nth(4).check();
    await approve.click();
    await expect(page.getByRole('status')).toContainText('Published');

    // The lesson is public now, and the coach sees the note on the other one.
    await page.context().clearCookies();
    await page.goto(`/learn/boxing/${live.slug}`);
    await expect(page.getByRole('heading', { level: 1, name: 'Pull counter' })).toBeVisible();
    await expect(page.getByText('Coach-verified')).toBeVisible();
    await expect(page.getByText('Reviewed by Rohan')).toBeVisible();

    await signInWithEmail(page, coach.email);
    await page.goto('/coach/lessons?status=needs_changes');
    await expect(page.getByText('Show the block from the side.')).toBeVisible();
  });

  test('a reviewer cannot approve their own lesson', async ({ page }) => {
    const both = await createUser(['athlete', 'coach', 'reviewer'], { name: 'Ananya' });
    const own = await submitted(both.email, 'My own lesson');
    await signInWithEmail(page, both.email);
    await page.goto('/review');
    await expect(page.getByRole('listitem').filter({ hasText: 'My own lesson' }).getByText('You wrote this. Another reviewer approves it.')).toBeVisible();
    await page.goto(`/review/${own.id}`);
    await expect(page.getByRole('note')).toHaveText('You wrote this. Another reviewer approves it.');
    await expect(page.getByRole('button', { name: 'Approve and publish' })).toHaveCount(0);
  });

  test('an athlete cannot open the queue', async ({ page }) => {
    const athlete = await createUser(['athlete']);
    await signInWithEmail(page, athlete.email);
    await page.goto('/review');
    await expect(page).toHaveURL(/\/not-allowed/);
  });
});
