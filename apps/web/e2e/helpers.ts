import { createDbClient } from '@fitsphere/db';
import { expect, type Page } from '@playwright/test';

// The local Supabase stack catches every email in Mailpit.
const MAILPIT = process.env.MAILPIT_URL ?? 'http://127.0.0.1:54324';

// Test-only admin client: reads auth state that RLS hides from the app.
export function admin() {
  return createDbClient(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '', process.env.SUPABASE_SECRET_KEY ?? '');
}

async function userByEmail(email: string) {
  // shortcut: reads the first 1000 users; fine because every local run starts from db reset.
  const { data, error } = await admin().auth.admin.listUsers({ perPage: 1000 });
  expect(error).toBeNull();
  return data.users.find((u) => u.email === email);
}

export async function userIdByEmail(email: string) {
  return (await userByEmail(email))?.id ?? '';
}

export async function accountState(email: string) {
  const user = await userByEmail(email);
  const { count } = await admin().from('profiles').select('id', { count: 'exact', head: true }).eq('id', user?.id ?? '');
  return { exists: !!user, confirmed: !!user?.email_confirmed_at, profiles: count ?? 0 };
}

export async function signInLink(email: string): Promise<string> {
  let id: string | undefined;
  await expect
    .poll(async () => {
      const res = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:"${email}"`)}`);
      id = (await res.json()).messages?.[0]?.ID;
      return id;
    }, { timeout: 15_000 })
    .toBeTruthy();
  const message = await (await fetch(`${MAILPIT}/api/v1/message/${id}`)).json();
  const link = String(message.HTML ?? message.Text).match(/https?:\/\/[^\s"'<>]+\/auth\/v1\/verify[^\s"'<>]+/)?.[0];
  if (!link) throw new Error(`No sign-in link in the email to ${email}`);
  return link.replaceAll('&amp;', '&');
}


/** Requests a link for a new address, opens it, and lands on sign-up step 1. */
export async function signUp(page: Page, email: string) {
  await page.goto('/sign-in');
  await page.getByLabel('Email').fill(email);
  await page.getByRole('button', { name: 'Email me a link' }).click();
  await expect(page.getByRole('heading', { name: 'Check your email' })).toBeVisible();
  await page.goto(await signInLink(email));
  await expect(page).toHaveURL('/welcome/1');
}

/** Fills sign-up step 1 and presses Continue. `dob` is YYYY-MM-DD. */
export async function fillAboutYou(page: Page, name: string, dob: string, sports: string[]) {
  const [year, month, day] = dob.split('-') as [string, string, string];
  await page.getByLabel('First name').fill(name);
  await page.getByLabel('Day').fill(day);
  await page.getByLabel('Month').fill(month);
  await page.getByLabel('Year').fill(year);
  for (const sport of sports) await page.getByRole('checkbox', { name: new RegExp(sport) }).check();
  await page.getByRole('button', { name: 'Continue' }).click();
}
