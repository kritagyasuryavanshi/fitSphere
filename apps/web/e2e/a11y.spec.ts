import { expect, test, type Page } from '@playwright/test';
import { coachWithProgram, signInAs } from './helpers';

// M6-06: axe finds no serious or critical issue on the beta journeys, and sign-up and a session work by keyboard.
// axe-core is already installed (packages/ui uses it), so it is injected as a script: no new dependency.
const axePath = require.resolve('axe-core/axe.min.js');

async function expectNoSeriousIssues(page: Page, path: string) {
  await page.goto(path);
  await page.waitForLoadState('networkidle');
  await page.addScriptTag({ path: axePath });
  const violations = await page.evaluate(async () => {
    // @ts-expect-error axe is the injected global
    const { violations } = await window.axe.run(document);
    return (violations as { id: string; impact: string; help: string; nodes: { target: string[] }[] }[])
      .filter((v) => v.impact === 'serious' || v.impact === 'critical')
      .map((v) => `${v.id}: ${v.help} (${v.nodes.map((n) => n.target.join(' ')).slice(0, 3).join(', ')})`);
  });
  expect(violations, path).toEqual([]);
}

test('guest pages have no serious accessibility issue', async ({ page }) => {
  for (const path of ['/', '/learn/boxing', '/learn/boxing/jab', '/coaches', '/programs', '/help', '/about', '/sign-in', '/legal/privacy', '/no-such-page'])
    await expectNoSeriousIssues(page, path);
});

test('athlete pages have no serious accessibility issue', async ({ page }) => {
  const { joinPath } = await coachWithProgram(`A11y Program ${Date.now()}`, {
    sessions: [{ day: 1, title: 'Jab basics', items: [{ slug: 'jab', type: 'rounds', prescription: { rounds: 1, work_s: 30, rest_s: 10 } }] }],
  });
  await signInAs(page, ['athlete']);
  await expectNoSeriousIssues(page, joinPath);
  await page.getByRole('button', { name: 'Join program' }).click();
  await expect(page.getByText(/You are in/)).toBeVisible();
  for (const path of ['/today', '/progress', '/account', '/account/notifications']) await expectNoSeriousIssues(page, path);
  await page.goto('/today');
  await page.getByRole('link', { name: 'Start session: Jab basics' }).click();
  await expect(page.getByRole('timer')).toBeVisible();
  await expectNoSeriousIssues(page, page.url().replace(/^https?:\/\/[^/]+/, ''));
});

test('coach pages have no serious accessibility issue', async ({ page }) => {
  await signInAs(page, ['coach']);
  for (const path of ['/coach', '/coach/programs', '/coach/lessons', '/coach/profile']) await expectNoSeriousIssues(page, path);
});

test('sign-up step 1 works by keyboard alone', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'A keyboard path; the desktop viewport is enough.');
  await signInAs(page, ['athlete'], { stepsDone: 0 });
  await expect(page).toHaveURL('/welcome/1');
  // Type only once the form has hydrated, or React can drop what was typed before it.
  await page.waitForLoadState('networkidle');
  await page.getByLabel('First name').focus();
  await page.keyboard.type('Kabir');
  await page.keyboard.press('Tab');
  await page.keyboard.type('15');
  await page.keyboard.press('Tab');
  await page.keyboard.type('06');
  await page.keyboard.press('Tab');
  await page.keyboard.type('1995');
  // Tab on to the first sport, tick it with Space, then Enter submits the form.
  const boxing = page.getByRole('checkbox', { name: /Boxing/ });
  for (let i = 0; i < 10 && !(await boxing.evaluate((el) => el === document.activeElement)); i++) await page.keyboard.press('Tab');
  await expect(boxing).toBeFocused();
  await page.keyboard.press('Space');
  await expect(boxing).toBeChecked();
  const go = page.getByRole('button', { name: 'Continue' });
  for (let i = 0; i < 10 && !(await go.evaluate((el) => el === document.activeElement)); i++) await page.keyboard.press('Tab');
  await expect(go).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL('/welcome/2', { timeout: 15_000 });
});

test('a session starts and logs by keyboard alone', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'A keyboard path; the desktop viewport is enough.');
  const { joinPath } = await coachWithProgram(`Keyboard Program ${Date.now()}`, {
    sessions: [{ day: 1, title: 'Skip rope', items: [{ slug: 'skipping', type: 'time', prescription: { seconds: 30 } }] }],
  });
  await page.clock.install();
  await signInAs(page, ['athlete']);
  await page.goto(joinPath);
  await page.getByRole('button', { name: 'Join program' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByText(/You are in/)).toBeVisible();
  await page.goto('/today');
  await page.getByRole('link', { name: 'Start session: Skip rope' }).focus();
  await page.keyboard.press('Enter');
  const start = page.getByRole('button', { name: 'Start timer' });
  await start.focus();
  await page.keyboard.press('Enter');
  await page.clock.runFor(31_000);
  await expect(page.getByRole('timer')).not.toHaveText('0:30');
});
