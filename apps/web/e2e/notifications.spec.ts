import { expect, test } from '@playwright/test';
import { admin, coachWithProgram, signInAs, userIdByEmail } from './helpers';

test.describe('Notifications', () => {
  test('feedback shows as unread, Mark all as read clears it, and an email switch saves', async ({ page }) => {
    const { coach, joinPath } = await coachWithProgram(`Ring Basics ${Date.now()}`, {
      sessions: [{ day: 1, title: 'Jab', items: [{ slug: 'skipping', type: 'time', prescription: { seconds: 300 } }] }],
    });
    const email = await signInAs(page, ['athlete'], { name: 'Neha' });
    const athlete = await userIdByEmail(email);
    await page.goto(joinPath);
    await page.getByRole('button', { name: 'Join program' }).click();
    await expect(page.getByText(/You are in/)).toBeVisible();

    // A feedback row as give_feedback writes it; the database trigger creates the notification.
    const db = admin();
    const { data: program } = await db.from('enrollments').select('program_id').eq('athlete_id', athlete).single();
    expect(
      (await db.from('feedback').insert({ athlete_id: athlete, coach_id: coach.id, program_id: program!.program_id, body: 'Keep the rear hand up.', coach_name: 'Vikram' })).error,
    ).toBeNull();

    await page.goto('/account');
    await page.getByRole('link', { name: 'Notifications' }).click();
    await expect(page).toHaveURL(/\/account\/notifications$/);
    await expect(page.getByText('1 unread')).toBeVisible();
    const item = page.getByRole('list', { name: 'Notifications' }).getByRole('listitem').first();
    await expect(item).toContainText('New');
    await expect(item.getByRole('link', { name: 'Vikram sent you feedback' })).toHaveAttribute('href', '/account/feedback');

    await page.getByRole('button', { name: 'Mark all as read' }).click();
    await expect(page.getByText('All read')).toBeVisible();
    await expect(item).not.toContainText('New');

    // Session reminder emails start off; turning one on survives a reload.
    const reminder = page.getByLabel('A reminder on days I have a session');
    await expect(reminder).not.toBeChecked();
    await reminder.check();
    await expect(reminder).toBeChecked();
    // The switch is disabled while it saves; reload only after the save finished.
    await expect(reminder).toBeEnabled();
    await page.reload();
    await expect(page.getByLabel('A reminder on days I have a session')).toBeChecked();
    await expect(page.getByLabel('Feedback from my coach')).toBeChecked();
  });
});
