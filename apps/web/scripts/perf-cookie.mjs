// M6-05: signs the seeded athlete in on a local test server (E2E_AUTH_CONFIRM=1) and prints a Cookie header, so
// Lighthouse can measure /today signed in. The cookie never leaves the CI runner.
import { createClient } from '@supabase/supabase-js';
import { chromium } from '@playwright/test';

const base = process.argv[2] ?? 'http://localhost:3000';
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY);
const { data, error } = await admin.auth.admin.generateLink({ type: 'magiclink', email: 'athlete@test.fitsphere' });
if (error) throw error;
const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(`${base}/auth/confirm?token_hash=${data.properties.hashed_token}&type=magiclink`);
await page.waitForURL(/\/today/);
const cookies = await page.context().cookies();
await browser.close();
process.stdout.write(cookies.map((c) => `${c.name}=${c.value}`).join('; '));
