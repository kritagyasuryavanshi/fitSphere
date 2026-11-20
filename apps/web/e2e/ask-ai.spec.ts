import { expect, test } from '@playwright/test';
import { admin, coachWithProgram, createUser, newPage, signInAs, signInWithEmail } from './helpers';

// A published, non-sample lesson the guide can cite (seeded lessons are samples, which it never cites).
async function citableLesson(title: string, summary: string) {
  const db = admin();
  const { data: d } = await db.from('disciplines').select('id').eq('category_id', 'boxing').order('sort').limit(1).single();
  const slug = `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const { error } = await db.from('content_items').insert({ discipline_id: d!.id, kind: 'skill', slug, title, summary, status: 'published', is_sample: false, published_at: new Date().toISOString() });
  expect(error).toBeNull();
  return slug;
}

test('an athlete asks, gets a cited answer, opens the cited lesson, and adds it to Today', async ({ page }) => {
  const word = `zorbguard${Date.now()}`;
  await citableLesson(`Holding the ${word}`, `Keep the ${word} high by your cheekbones when you are tired.`);
  await signInAs(page, ['athlete'], { name: 'Kabir' });
  await page.goto('/ask');
  await expect(page.getByText('10 of 10 questions left today')).toBeVisible();

  await page.getByLabel('Your question').fill(`How do I keep my ${word} up when I am tired?`);
  await page.getByRole('button', { name: 'Ask' }).click();
  const answer = page.getByRole('article', { name: 'Answer' });
  await expect(answer).toContainText('AI explanation · based on 1 coach-verified lesson');
  await expect(answer).toContainText(`Keep the ${word} high`);
  await expect(page.getByText('9 of 10 questions left today')).toBeVisible();
  // The question is in the history.
  await expect(page.getByRole('navigation', { name: 'Past questions' })).toContainText(`How do I keep my ${word} up`);

  await answer.getByRole('button', { name: 'Add to Today' }).click();
  await expect(page.getByText('Added to Today.')).toBeVisible();
  await page.goto('/today');
  await expect(page.getByRole('region', { name: 'Added from Ask AI' })).toContainText(`Holding the ${word}`);

  await page.goto('/ask');
  await page.getByRole('article', { name: 'Answer' }).getByRole('link', { name: `Holding the ${word}` }).click();
  await expect(page.getByRole('heading', { level: 1, name: `Holding the ${word}` })).toBeVisible();
});

test('a question the library does not cover says so', async ({ page }) => {
  await signInAs(page, ['athlete'], { name: 'Asha' });
  await page.goto('/ask');
  await page.getByLabel('Your question').fill('How do I keep my car battery charged in winter?');
  await page.getByRole('button', { name: 'Ask' }).click();
  await expect(page.getByRole('article', { name: 'Answer' })).toContainText('no library source');
});

test('a pain question gets a referral, and the coach sees a pain flag', async ({ page, browser }) => {
  const { coach, programId } = await coachWithProgram('Boxing Basics', { coachName: 'Vikram' });
  const athlete = await createUser(['athlete'], { name: 'Ravi' });
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
  expect((await admin().from('enrollments').insert({ program_id: programId, athlete_id: athlete.id, start_date: today })).error).toBeNull();

  await signInWithEmail(page, athlete.email);
  await page.goto('/ask');
  await page.getByLabel('Your question').fill('My right shoulder hurts after bag work. What is wrong with it?');
  await page.getByRole('button', { name: 'Ask' }).click();
  const answer = page.getByRole('article', { name: 'Answer' });
  await expect(answer).toContainText('Safety · no diagnosis');
  await expect(answer).toContainText('doctor or physiotherapist');

  const coachPage = await newPage(browser);
  await signInWithEmail(coachPage, coach.email);
  await coachPage.goto('/coach');
  await expect(coachPage.getByText('Reported pain').first()).toBeVisible();
  await coachPage.context().close();
});
