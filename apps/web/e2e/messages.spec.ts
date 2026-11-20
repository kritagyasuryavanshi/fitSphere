import { expect, test } from '@playwright/test';
import { liveCoach, newPage, signInAs, signInWithEmail } from './helpers';

test('an athlete and a coach message each other; a new message shows within 10 seconds', async ({ page, browser }) => {
  const coach = await liveCoach('Kiran', `Chatpur ${Date.now()}`, 450000);
  await signInAs(page, ['athlete'], { name: 'Kabir' });
  await page.goto(`/hire/${coach.id}`);
  await page.getByRole('form', { name: 'Hire Kiran' }).getByRole('button', { name: 'Send request' }).click();
  await expect(page).toHaveURL('/coaching');

  // The athlete opens the conversation from their coaching.
  await page.getByRole('button', { name: 'Message Kiran' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Kiran' })).toBeVisible();
  await expect(page.getByRole('note')).toHaveText('Keep payments on FitSphere. Paying outside means no refund protection and no verified review.');
  const athleteChat = page.url();

  // The coach opens it from Clients and keeps it open.
  const coachPage = await newPage(browser);
  await signInWithEmail(coachPage, coach.email);
  await coachPage.goto('/coach/clients');
  await coachPage.getByRole('button', { name: 'Message Kabir' }).click();
  await expect(coachPage).toHaveURL(athleteChat.replace(/^https?:\/\/[^/]+/, ''));
  await expect(coachPage.getByRole('note')).toBeVisible();

  // The athlete writes; the coach's open page shows it without a reload.
  await page.getByLabel('Message Kiran').fill('Hi Kiran. Old left knee injury.');
  await page.getByRole('button', { name: 'Send' }).click();
  await expect(page.getByRole('list', { name: 'Messages' })).toContainText('Hi Kiran. Old left knee injury.');
  await expect(page.getByLabel('Message Kiran')).toHaveValue('');
  await expect(coachPage.getByRole('list', { name: 'Messages' })).toContainText('Hi Kiran. Old left knee injury.', { timeout: 10_000 });

  // And back the other way.
  await coachPage.getByLabel('Message Kabir').fill('Happy to take you on.');
  await coachPage.getByRole('button', { name: 'Send' }).click();
  await expect(page.getByRole('list', { name: 'Messages' })).toContainText('Happy to take you on.', { timeout: 10_000 });
});
