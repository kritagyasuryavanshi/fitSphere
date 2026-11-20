import { defineConfig, devices } from '@playwright/test';

// Local keys come from .env.local; CI writes the same file from `supabase status`.
try {
  process.loadEnvFile('.env.local');
} catch {}

// E2E_PORT runs the tests beside a server already on 3000.
const port = process.env.E2E_PORT ?? '3000';

export default defineConfig({
  testDir: './e2e',
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: { baseURL: `http://localhost:${port}`, trace: 'on-first-retry' },
  projects: [
    { name: 'phone', use: { ...devices['Desktop Chrome'], viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
  ],
  webServer: {
    // CI tests the production build; locally the dev server is faster.
    command: `${process.env.CI ? 'npm run start' : 'npm run dev'} -- -p ${port}`,
    url: `http://localhost:${port}`,
    reuseExistingServer: !process.env.CI,
    // Turns on the test-only /auth/confirm sign-in route (see src/app/auth/confirm/route.ts).
    // The fake AI answerer and the fake payment provider, never in production (lib/ai/model.ts, lib/payments).
    env: { E2E_AUTH_CONFIRM: '1', AI_PROVIDER: 'fake', PAYMENTS_PROVIDER: 'fake', PAYMENTS_WEBHOOK_SECRET: 'e2e-webhook-secret' },
  },
});
