// M6-05: signs the seeded athlete in on a local test server (E2E_AUTH_CONFIRM=1) and prints a Cookie header, so
// Lighthouse can measure /today signed in. The cookie never leaves the CI runner.
import { createClient } from '@supabase/supabase-js';
import { chromium } from '@playwright/test';

const base = process.argv[2] ?? 'http://localhost:3000';
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY);
// A fresh athlete who has finished sign-up, as the e2e helper makes one, so sign-in lands on /today.
const email = `perf-${Date.now()}@test.fitsphere`;
const created = await admin.auth.admin.createUser({ email, email_confirm: true });
if (created.error) throw created.error;
const id = created.data.user.id;
for (const r of [
  await admin.from('profiles').update({ display_name: 'Perf', date_of_birth: '1998-06-12' }).eq('id', id),
  await admin.from('athlete_basics').insert({ user_id: id, days_per_week: 4 }),
]) if (r.error) throw r.error;
const { data, error } = await admin.auth.admin.generateLink({ type: 'magiclink', email });
if (error) throw error;
const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(`${base}/auth/confirm?token_hash=${data.properties.hashed_token}&type=magiclink`);
await page.waitForURL(/\/today/);
const cookies = await page.context().cookies();
await browser.close();
process.stdout.write(cookies.map((c) => `${c.name}=${c.value}`).join('; '));
