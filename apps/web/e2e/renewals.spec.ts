import { expect, test } from '@playwright/test';
import { admin, liveCoach, signInAs } from './helpers';

test('a monthly client pays, a subscription opens, and they cancel to the end of the paid month', async ({ page }) => {
  const coach = await liveCoach('Leela', `Renewpur ${Date.now()}`, 450000);
  await signInAs(page, ['athlete'], { name: 'Kabir' });
  await page.goto(`/hire/${coach.id}`);
  await page.getByRole('form', { name: 'Hire Leela' }).getByRole('button', { name: 'Send request' }).click();
  await expect(page).toHaveURL('/coaching');
  // The coach accepts (hire.spec.ts tests that flow); the athlete pays with the fake provider (payments.spec.ts).
  expect((await admin().from('engagements').update({ status: 'accepted', decided_at: new Date().toISOString() }).eq('coach_id', coach.id)).error).toBeNull();
  await page.reload();
  await page.getByRole('link', { name: 'Pay ₹4,500' }).click();
  await page.getByRole('button', { name: 'Pay ₹4,500' }).click();
  await expect(page.getByRole('status')).toContainText('Payment received');

  // The monthly coaching now renews through a subscription.
  const { data: g } = await admin().from('engagements').select('id').eq('coach_id', coach.id).single();
  const { data: sub } = await admin().from('subscriptions').select('provider_subscription_id, status').eq('engagement_id', g!.id).single();
  expect(sub!.provider_subscription_id).toMatch(/^fake_sub_/);
  await page.goto('/coaching');
  await expect(page.getByText(/^Renews monthly · next payment ₹4,500 on \d{1,2} [A-Z][a-z]{2,3}$/)).toBeVisible();

  await page.getByRole('link', { name: 'Cancel coaching' }).click();
  const dialog = page.getByRole('alertdialog', { name: 'Cancel coaching with Leela?' });
  await expect(dialog).toContainText('the end of the month you paid for');
  await dialog.getByLabel(/Why are you leaving/).selectOption('Taking a break');
  await dialog.getByRole('button', { name: 'Cancel coaching' }).click();
  await expect(page).toHaveURL('/coaching');
  await expect(page.getByText('Cancelled · runs to the end of the paid month')).toBeVisible();
  await expect(page.getByText(/^Coaching until \d{1,2} [A-Z][a-z]{2,3}\. No more payments are taken\.$/)).toBeVisible();
  await expect(page.getByRole('link', { name: 'Cancel coaching' })).toHaveCount(0);

  // The database agrees: cancelling, the reason kept apart, and both people emailed.
  const { data: after } = await admin().from('engagements').select('status, cancel_at_period_end').eq('id', g!.id).single();
  expect(after).toEqual({ status: 'cancelling', cancel_at_period_end: true });
  const { data: reason } = await admin().from('cancel_reasons').select('reason').eq('engagement_id', g!.id).single();
  expect(reason!.reason).toBe('taking_break');
  const { count } = await admin().from('email_outbox').select('id', { count: 'exact', head: true }).eq('template', 'coaching_cancelled').eq('data->>engagement', g!.id);
  expect(count).toBe(2);
});
