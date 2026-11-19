import { expect, test } from '@playwright/test';
import { admin, createUser } from './helpers';

// A live coach straight in the database: the profile editor has its own test (coach-profile.spec.ts).
async function liveCoach(name: string, city: string, pricePaise: number) {
  const coach = await createUser(['athlete', 'coach'], { name });
  const db = admin();
  const { data: version } = await db.rpc('current_coach_agreement');
  const ok = ({ error }: { error: unknown }) => expect(error).toBeNull();
  ok(await db.from('coach_profiles').insert({ coach_id: coach.id, headline: `${name} coaches boxing`, specialties: ['Boxing'], formats: ['online'], city, years: 6, status: 'live', agreement_version: version }));
  ok(await db.from('packages').insert({ coach_id: coach.id, title: 'Monthly', kind: 'monthly', price_paise: pricePaise, live: true }));
  return coach;
}

test.describe('Find a coach', () => {
  test('the price filter shows only coaches in range', async ({ page }) => {
    // A city of its own, so coaches from other tests do not count.
    const city = `Testpur ${Date.now()}`;
    await liveCoach('Meera', city, 300000);
    await liveCoach('Kunal', city, 500000);
    await liveCoach('Tara', city, 900000);

    await page.goto('/coaches');
    await expect(page.getByRole('heading', { level: 1, name: 'Find a coach' })).toBeVisible();
    await page.getByLabel('City').selectOption(city);
    const results = page.getByRole('region', { name: 'Coaches' });
    await expect(results.getByText('3 coaches')).toBeVisible();

    await page.getByLabel('Min ₹').fill('4,000');
    await page.getByLabel('Max ₹').fill('6000');
    await page.getByRole('button', { name: 'Show results' }).click();
    await expect(results.getByText('1 coach', { exact: true })).toBeVisible();
    await expect(results.getByRole('link', { name: 'Kunal' })).toBeVisible();
    await expect(results.getByText('From ₹5,000/month')).toBeVisible();
    await expect(results.getByRole('link', { name: 'Meera' })).toHaveCount(0);
    await expect(results.getByRole('link', { name: 'Tara' })).toHaveCount(0);

    // Price sort, low to high, with the range cleared.
    await page.goto(`/coaches?city=${encodeURIComponent(city)}&sort=price`);
    await expect(results.getByRole('link')).toHaveText(['Meera', 'Kunal', 'Tara']);

    // A card opens the coach's public profile.
    await results.getByRole('link', { name: 'Kunal' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Kunal' })).toBeVisible();
  });
});
