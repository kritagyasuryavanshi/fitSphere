import { expect, test } from '@playwright/test';
import { admin, createUser, liveCoach, signInWithEmail } from './helpers';

// M4-17: the athlete of an accepted single-session request holds a time, pays, and the time is booked.
test('an athlete holds a session time, pays, and the session is booked', async ({ page }) => {
  const coach = await liveCoach('Vikram', 'Mumbai', 450000);
  const athlete = await createUser(['athlete'], { name: 'Kabir' });
  const db = admin();
  const ok = ({ error }: { error: unknown }) => expect(error).toBeNull();
  const { data: pkg } = await db.from('packages').insert({ coach_id: coach.id, title: 'Form check', kind: 'single', price_paise: 120000, live: true, minutes: 60 }).select('id').single();
  // Every day, 07:00 to 09:00 India time.
  ok(await db.from('availability_slots').insert([1, 2, 3, 4, 5, 6, 7].map((dow) => ({ coach_id: coach.id, dow, start_time: '07:00', minutes: 120 }))));
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
  const { data: g } = await db
    .from('engagements')
    .insert({ athlete_id: athlete.id, coach_id: coach.id, package_id: pkg!.id, package_title: 'Form check', package_kind: 'single', price_paise: 120000, fee_bps: 1500,
      start_date: today, days_per_week: 3, status: 'accepted', share_data: true })
    .select('id')
    .single();

  await signInWithEmail(page, athlete.email);
  await page.goto(`/coaching/${g!.id}/pay`);
  const time = page.getByRole('region', { name: 'Your session time' });
  await expect(page.getByRole('button', { name: /^Pay / })).toHaveCount(0);
  await time.getByRole('button', { name: 'Hold this time' }).click();
  await expect(page.getByText(/Held for you:/)).toBeVisible();
  await page.getByRole('button', { name: 'Pay ₹1,200' }).click();

  await expect
    .poll(async () => (await db.from('bookings').select('status').eq('engagement_id', g!.id).eq('status', 'confirmed')).data?.length ?? 0, { timeout: 10_000 })
    .toBe(1);
  const { data: e } = await db.from('engagements').select('status').eq('id', g!.id).single();
  expect(e?.status).toBe('active');
});
