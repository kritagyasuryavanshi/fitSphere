import { createDbClient } from '@fitsphere/db';
import { expect, type Browser, type Page } from '@playwright/test';

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
 * Creates a confirmed user with exactly these roles and signs them in through the test-only /auth/confirm.
 * It uses the admin API, so no email is sent and the 60-second resend limit never applies.
 * stepsDone: 0 = nothing saved, 1 = step 1 saved, 2 = sign-up done (steps 3 and 4 are optional).
 */
export async function signInAs(page: Page, roles: Role[], options: { stepsDone?: number; name?: string } = {}) {
  const { email } = await createUser(roles, options);
  await signInWithEmail(page, email);
  return email;
}

/** Signs an existing user in again through the test-only /auth/confirm. */
export async function signInWithEmail(page: Page, email: string) {
  const { data: link, error } = await admin().auth.admin.generateLink({ type: 'magiclink', email });
  expect(error).toBeNull();
  await page.goto(`/auth/confirm?token_hash=${link.properties!.hashed_token}&type=magiclink`);
}

/**
 * A coach (named Vikram) with one program, published unless told otherwise, and its invite path.
 * Rows go in through the service role to keep specs short; joining goes through the real screens.
 */
type SeedSession = { day: number; title: string; items: { slug: string; type: 'rounds' | 'time' | 'sets'; prescription: Record<string, number>; cue?: string }[] };

export async function coachWithProgram(
  title: string,
  { published = true, category = 'boxing', coachName = 'Vikram', sessions = [] as SeedSession[] } = {},
) {
  const db = admin();
  const coach = await createUser(['athlete', 'coach'], { name: coachName });
  const { data: program, error } = await db.from('programs').insert({ coach_id: coach.id, category_id: category, title, weeks: 6 }).select('id').single();
  expect(error).toBeNull();
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
  const versions = published
    ? [
        { program_id: program!.id, version: 1, published_at: new Date().toISOString(), effective_from: today, title, summary: '', weeks: 6 },
        { program_id: program!.id, version: 2 },
      ]
    : [{ program_id: program!.id, version: 1 }];
  expect((await db.from('program_versions').insert(versions)).error).toBeNull();
  // Sessions go on version 1, which athletes follow from today: week 1, day 1 is the day they join.
  const { data: v1 } = await db.from('program_versions').select('id').eq('program_id', program!.id).eq('version', 1).single();
  for (const [n, s] of sessions.entries()) {
    const { data: row, error: sessionError } = await db.from('program_sessions').insert({ version_id: v1!.id, week: 1, day: s.day, position: n + 1, title: s.title }).select('id').single();
    expect(sessionError).toBeNull();
    for (const [i, it] of s.items.entries()) {
      const { data: item } = await db.from('content_items').select('id').eq('slug', it.slug).eq('status', 'published').limit(1).single();
      expect((await db.from('session_items').insert({ session_id: row!.id, position: i + 1, item_id: item!.id, type: it.type, prescription: it.prescription, cue: it.cue ?? '' })).error).toBeNull();
    }
  }
  const code =[...crypto.getRandomValues(new Uint8Array(16))].map((b) => b.toString(16).padStart(2, '0')).join('');
  expect((await db.from('invites').insert({ code, program_id: program!.id })).error).toBeNull();
  return { coach, programId: program!.id, joinPath: `/join/${code}` };
}

/** A page in a fresh browser context, for a second person in the same test. */
export async function newPage(browser: Browser) {
  return (await browser.newContext()).newPage();
}

/** Creates a confirmed user with exactly these roles, without signing in. */
export async function createUser(roles: Role[], { stepsDone = 2, name = 'Kabir' }: { stepsDone?: number; name?: string } = {}) {
  const db = admin();
  const email = `e2e-${roles.join('-') || 'none'}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@test.fitsphere`;
  const { data: created, error } = await db.auth.admin.createUser({ email, email_confirm: true });
  expect(error).toBeNull();
  const id = created.user!.id;
  const check = ({ error }: { error: unknown }) => expect(error).toBeNull();

  if (stepsDone >= 1) check(await db.from('profiles').update({ display_name: name, date_of_birth: '1998-06-12' }).eq('id', id));
  if (stepsDone >= 2) check(await db.from('athlete_basics').insert({ user_id: id, days_per_week: 4 }));
  // The sign-up trigger gave the athlete role; make the roles match exactly.
  if (!roles.includes('athlete')) check(await db.from('user_roles').delete().eq('user_id', id).eq('role', 'athlete'));
  const extra = roles.filter((r) => r !== 'athlete');
  if (extra.length) check(await db.from('user_roles').insert(extra.map((role) => ({ user_id: id, role }))));
  return { id, email };
}
