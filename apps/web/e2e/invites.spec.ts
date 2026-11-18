import { expect, test, type Browser } from '@playwright/test';
import { admin, createUser, signInAs, signInWithEmail } from './helpers';

/** A coach with one program; published unless told otherwise. Rows go in through the service role to keep the spec short. */
async function coachWithProgram(title: string, { published = true } = {}) {
  const db = admin();
  const coach = await createUser(['athlete', 'coach'], { name: 'Vikram' });
  const { data: program, error } = await db.from('programs').insert({ coach_id: coach.id, category_id: 'boxing', title, weeks: 6 }).select('id').single();
  expect(error).toBeNull();
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
  const versions = published
    ? [
        { program_id: program!.id, version: 1, published_at: new Date().toISOString(), effective_from: today },
        { program_id: program!.id, version: 2 },
      ]
    : [{ program_id: program!.id, version: 1 }];
  expect((await db.from('program_versions').insert(versions)).error).toBeNull();
  return { coach, programId: program!.id };
}

async function newPage(browser: Browser) {
  return (await browser.newContext()).newPage();
}

test.describe('invite links', () => {
  test('a coach shares a link, an athlete joins, and a reset closes the old link', async ({ page, browser }) => {
    const title = `Boxing Fundamentals ${Date.now()}`;
    const { coach, programId } = await coachWithProgram(title);
    await signInWithEmail(page, coach.email);

    await page.goto('/coach/programs');
    const card = page.getByRole('list', { name: 'Programs' }).getByRole('listitem').filter({ hasText: title });
    await expect(card).toContainText('no athletes yet');
    await card.getByRole('link', { name: /^Invite/ }).click();
    await expect(page).toHaveURL(new RegExp(`/coach/programs/${programId}/invite$`));
    await expect(page.getByText('Nobody has joined yet.')).toBeVisible();
    const link = await page.getByRole('textbox', { name: 'Invite link' }).inputValue();
    expect(link).toMatch(/\/join\/[0-9a-f]{32}$/);
    await page.reload();
    expect(await page.getByRole('textbox', { name: 'Invite link' }).inputValue()).toBe(link);

    // A guest sees the program and is asked to sign in first.
    const guest = await newPage(browser);
    await guest.goto(new URL(link).pathname);
    await expect(guest.getByRole('heading', { name: title })).toBeVisible();
    await expect(guest.getByText('Vikram invited you to')).toBeVisible();
    await expect(guest.getByRole('link', { name: 'Sign in or join free' })).toBeVisible();
    // A query string cannot fake the joined state.
    await guest.goto(`${new URL(link).pathname}?joined=1`);
    await expect(guest.getByRole('link', { name: 'Sign in or join free' })).toBeVisible();
    await expect(guest.getByText(/You are in/)).toHaveCount(0);

    // The coach opening their own link is told so, with no Join button.
    await page.goto(new URL(link).pathname);
    await expect(page.getByText('This is your own program.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Join program' })).toHaveCount(0);
    await page.goto(`/coach/programs/${programId}/invite`);

    // An athlete who finished sign-up joins.
    const athlete = await newPage(browser);
    await signInAs(athlete, ['athlete'], { name: 'Kabir' });
    await athlete.goto(new URL(link).pathname);
    await athlete.getByRole('button', { name: 'Join program' }).click();
    await expect(athlete.getByRole('status')).toContainText(`You are in ${title}.`);
    await athlete.reload();
    await expect(athlete.getByRole('link', { name: 'Go to Today' })).toBeVisible();

    await page.reload();
    await expect(page.getByRole('heading', { name: 'Joined · 1' })).toBeVisible();
    await expect(page.getByRole('list', { name: 'Joined athletes' })).toContainText('Kabir');

    // Reset needs the confirm screen; then the old link admits nobody.
    await page.getByRole('link', { name: 'Reset link' }).click();
    await expect(page.getByRole('alertdialog', { name: 'Reset the invite link?' })).toBeVisible();
    await page.getByRole('button', { name: 'Reset link' }).click();
    await expect(page.getByText('New link made. The old link no longer works.')).toBeVisible();
    expect(await page.getByRole('textbox', { name: 'Invite link' }).inputValue()).not.toBe(link);
    await expect(page.getByRole('list', { name: 'Joined athletes' })).toContainText('Kabir');

    const late = await newPage(browser);
    await signInAs(late, ['athlete'], { name: 'Arjun' });
    await late.goto(new URL(link).pathname);
    await expect(late.getByRole('heading', { name: 'This link is no longer active' })).toBeVisible();
    await expect(late.getByText(title)).toHaveCount(0);

    await page.goto('/coach/programs');
    await expect(card).toContainText('1 athlete');
  });

  test('someone who has not finished sign-up is sent to the next step', async ({ page, browser }) => {
    const { coach, programId } = await coachWithProgram(`Footwork Lab ${Date.now()}`);
    const coachPage = await newPage(browser);
    await signInWithEmail(coachPage, coach.email);
    await coachPage.goto(`/coach/programs/${programId}/invite`);
    const link = await coachPage.getByRole('textbox', { name: 'Invite link' }).inputValue();

    await signInAs(page, ['athlete'], { stepsDone: 1 });
    await page.goto(new URL(link).pathname);
    await page.getByRole('button', { name: 'Join program' }).click();
    await expect(page).toHaveURL(/\/welcome\/2/);
  });

  test('an unpublished program cannot be joined yet', async ({ page, browser }) => {
    const title = `Southpaw basics ${Date.now()}`;
    const { coach, programId } = await coachWithProgram(title, { published: false });
    const coachPage = await newPage(browser);
    await signInWithEmail(coachPage, coach.email);
    await coachPage.goto(`/coach/programs/${programId}/invite`);
    const link = await coachPage.getByRole('textbox', { name: 'Invite link' }).inputValue();

    await signInAs(page, ['athlete']);
    await page.goto(new URL(link).pathname);
    await expect(page.getByRole('heading', { name: 'Not open yet' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Join program' })).toHaveCount(0);
  });

  // The page streams behind Suspense, so notFound() shows the not-found page with a 200 status.
  test('a code that never existed is not found', async ({ page }) => {
    await page.goto(`/join/${'0'.repeat(32)}`);
    await expect(page.getByText(/could not be found/i)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Join program' })).toHaveCount(0);
  });
});
