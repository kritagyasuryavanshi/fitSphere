import { expect, test } from '@playwright/test';
import { createUser, signInWithEmail } from './helpers';

test.describe('Coach marketplace profile', () => {
  test('a coach fills the profile, accepts the agreement, goes live, and edits show on the public profile', async ({ page }) => {
    const coach = await createUser(['athlete', 'coach'], { name: 'Vikram' });
    await signInWithEmail(page, coach.email);
    await page.goto('/coach/profile');

    const about = page.getByRole('form', { name: 'About you' });
    await about.getByLabel('Headline').fill('Boxing coach for beginners, 10 years');
    await about.getByLabel('How you coach').fill('Slow reps first. Speed comes when the shape is right.');
    await about.getByLabel('Specialties (comma-separated)').fill('Boxing, Footwork');
    await about.getByLabel('Languages (comma-separated)').fill('English, Hindi');
    await about.getByLabel('Online').check();
    await about.getByLabel('City').fill('Pune');
    await about.getByLabel('Years coaching').fill('10');
    await about.getByRole('button', { name: 'Save profile' }).click();
    await expect(about.getByText('Profile saved.')).toBeVisible();

    // A package; a bad price is refused.
    const add = page.getByRole('form', { name: 'Add a package' });
    await add.getByLabel('Package').fill('Monthly coaching');
    await add.getByLabel('Price ₹').fill('45.678');
    await add.getByRole('button', { name: 'Add' }).click();
    await expect(add.getByText('Enter a price from ₹0.01 to ₹10,00,000.')).toBeVisible();
    // What was typed survives the refusal.
    await expect(add.getByLabel('Package')).toHaveValue('Monthly coaching');
    await add.getByLabel('Price ₹').fill('4,500');
    await add.getByRole('button', { name: 'Add' }).click();
    await expect(page.getByRole('form', { name: 'Package: Monthly coaching' })).toBeVisible();

    // A weekly slot.
    const slots = page.getByRole('group', { name: 'Weekly 1:1 slots' });
    await slots.getByRole('button', { name: 'Add slot' }).click();
    await slots.getByRole('button', { name: 'Save slots' }).click();
    await expect(slots.getByText('Slots saved.')).toBeVisible();

    // Going live needs the agreement first.
    await page.getByRole('button', { name: 'Go live' }).click();
    await expect(page.getByText('Accept the coach agreement before you go live.')).toBeVisible();
    await page.getByRole('button', { name: 'I accept the coach agreement' }).click();
    await expect(page.getByText('You accepted this version.')).toBeVisible();
    await page.getByRole('button', { name: 'Go live' }).click();
    await expect(page.getByRole('heading', { name: 'Your profile is live' })).toBeVisible();

    // The public profile shows it; an edit shows too.
    await page.getByRole('link', { name: 'Preview public profile' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Vikram' })).toBeVisible();
    await expect(page.getByText('Boxing coach for beginners, 10 years')).toBeVisible();
    await expect(page.getByRole('region', { name: 'Packages' })).toContainText('₹4,500 a month');
    await expect(page.getByText('Credentials self-reported')).toBeVisible();
    await expect(page.getByRole('region', { name: 'Weekly 1:1 slots' })).toContainText('Mon 18:00');

    await page.goto('/coach/profile');
    await page.getByRole('form', { name: 'About you' }).getByLabel('Headline').fill('Boxing coach, 11 years');
    await page.getByRole('form', { name: 'About you' }).getByRole('button', { name: 'Save profile' }).click();
    await expect(page.getByText('Profile saved.')).toBeVisible();
    await page.goto(`/coaches/${coach.id}`);
    await expect(page.getByText('Boxing coach, 11 years')).toBeVisible();
  });

  test('a coach who is not live has no public profile', async ({ page }) => {
    const coach = await createUser(['athlete', 'coach'], { name: 'Ananya' });
    // notFound() inside Suspense streams a soft 404: the not-found page with status 200 (as in library.spec.ts).
    await page.goto(`/coaches/${coach.id}`);
    await expect(page.getByRole('heading', { name: 'Out of the ring.' })).toBeVisible();
  });
});
