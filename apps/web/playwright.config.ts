import { defineConfig, devices } from '@playwright/test';

// Local keys come from .env.local; CI writes the same file from `supabase status`.
try {
  process.loadEnvFile('.env.local');
} catch {}

export default defineConfig({
  testDir: './e2e',
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: { baseURL: 'http://localhost:3000', trace: 'on-first-retry' },
  projects: [
    { name: 'phone', use: { ...devices['Desktop Chrome'], viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
  ],
  webServer: {
    // CI tests the production build; locally the dev server is faster.
    command: process.env.CI ? 'npm run start' : 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    // Turns on the test-only /auth/confirm sign-in route (see src/app/auth/confirm/route.ts).
    env: { E2E_AUTH_CONFIRM: '1' },
  },
});
