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

/** Picks a pill answer by clicking its visible label. The radio inside is visually hidden, so a forced check could hit a neighbour. */
export async function choose(page: Page, label: string) {
  // Labels here are plain words and digits; match the whole text so "No" never matches "New to it".
  // Next keeps the previous step mounted but hidden, so only visible labels count.
  await page.locator('label').filter({ hasText: new RegExp(`^${label}$`), visible: true }).click();
}

type Role = 'athlete' | 'coach' | 'reviewer' | 'admin';

/**
 * Creates a confirmed user with exactly these roles and signs them in through /auth/confirm.
 * It uses the admin API, so no email is sent and the 60-second resend limit never applies.
 */
export async function signInAs(page: Page, roles: Role[], { signedUp = true, name = 'Kabir' } = {}) {
  const db = admin();
  const email = `e2e-${roles.join('-') || 'none'}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@test.fitsphere`;
  const { data: created, error } = await db.auth.admin.createUser({ email, email_confirm: true });
  expect(error).toBeNull();
  const id = created.user!.id;
  if (signedUp) await db.from('profiles').update({ display_name: name, date_of_birth: '1998-06-12' }).eq('id', id);
  // The sign-up trigger gave the athlete role; make the roles match exactly.
  await db.from('user_roles').delete().eq('user_id', id).not('role', 'in', `(${roles.join(',') || 'none'})`);
  const extra = roles.filter((r) => r !== 'athlete');
  if (extra.length) await db.from('user_roles').insert(extra.map((role) => ({ user_id: id, role })));

  const { data: link, error: linkError } = await db.auth.admin.generateLink({ type: 'magiclink', email });
  expect(linkError).toBeNull();
  await page.goto(`/auth/confirm?token_hash=${link.properties!.hashed_token}&type=magiclink`);
  return email;
}
