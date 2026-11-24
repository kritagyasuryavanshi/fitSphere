import { expect, test } from '@playwright/test';
import { admin, liveCoach, newPage, signInAs, signInWithEmail } from './helpers';

test('an athlete requests coaching, the coach accepts, and the athlete sees Pay', async ({ page, browser }) => {
  const coach = await liveCoach('Ishaan', `Hirepur ${Date.now()}`, 450000);

  // The athlete asks.
  await signInAs(page, ['athlete'], { name: 'Kabir' });
  await page.goto(`/coaches/${coach.id}`);
  await page.getByRole('link', { name: 'Hire Ishaan' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Hire Ishaan' })).toBeVisible();
  const form = page.getByRole('form', { name: 'Hire Ishaan' });
  await expect(form.getByRole('radio', { name: /Monthly/ })).toBeChecked();
  await form.getByLabel('Days you can train').selectOption('4');
  await form.getByLabel('What do you want from coaching?').fill('Clean technique. Old left knee injury, no jumping.');
  await form.getByRole('button', { name: 'Send request' }).click();
  await expect(page).toHaveURL('/coaching');
  await expect(page.getByText('Waiting for the coach')).toBeVisible();
  // Back on the profile, the athlete is sent to their coaching, not to a second request.
  await page.goto(`/coaches/${coach.id}`);
  await expect(page.getByRole('link', { name: 'View your coaching' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Hire Ishaan' })).toHaveCount(0);
  await page.goto('/coaching');

  // The coach sees it, with what was asked, and accepts.
  const coachPage = await newPage(browser);
  await signInWithEmail(coachPage, coach.email);
  await coachPage.goto('/coach/clients');
  const requests = coachPage.getByRole('region', { name: 'Requests' });
  await expect(requests).toContainText('Kabir');
  await expect(requests).toContainText('4 days a week');
  await expect(requests).toContainText('Old left knee injury, no jumping.');
  await expect(requests).toContainText('Shares training logs while a client.');
  await requests.getByRole('button', { name: 'Accept Kabir' }).click();
  await expect(requests.getByText('Accepted · awaiting payment')).toBeVisible();
  // The coach is an athlete too, but a client's request is not the coach's own coaching.
  await coachPage.goto('/coaching');
  await expect(coachPage.getByText('No coaching yet.')).toBeVisible();

  // The athlete sees the accept and a Pay button.
  await page.reload();
  await expect(page.getByText('Accepted · pay to start')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Pay ₹4,500' })).toBeVisible();
  await page.getByRole('link', { name: 'Pay ₹4,500' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Pay' })).toBeVisible();
});

test('a coach at the client limit is not taking new clients', async ({ page, browser }) => {
  const coach = await liveCoach('Jaya', `Fullpur ${Date.now()}`, 300000);
  expect((await admin().from('coach_profiles').update({ client_limit: 1 }).eq('coach_id', coach.id)).error).toBeNull();
  await signInAs(page, ['athlete'], { name: 'Asha' });
  await page.goto(`/hire/${coach.id}`);
  await page.getByRole('form', { name: 'Hire Jaya' }).getByRole('button', { name: 'Send request' }).click();
  await expect(page).toHaveURL('/coaching');
  // Accepting fills the one place.
  const { data: g } = await admin().from('engagements').select('id').eq('coach_id', coach.id).single();
  expect((await admin().from('engagements').update({ status: 'accepted' }).eq('id', g!.id)).error).toBeNull();
  // Asha holds the place, so she sees her coaching; anyone else sees the coach is full.
  await page.goto(`/coaches/${coach.id}`);
  await expect(page.getByRole('link', { name: 'View your coaching' })).toBeVisible();
  const guest = await newPage(browser);
  await guest.goto(`/coaches/${coach.id}`);
  await expect(guest.getByText('Not taking new clients right now')).toBeVisible();
  await expect(guest.getByRole('link', { name: 'Hire Jaya' })).toHaveCount(0);
});
