---
name: lesson-prod-build-e2e
type: lesson
description: 2026-11-12: run e2e against a production build (CI=1) before pushing; dev mode hid four bugs
updated: 2026-11-12
---

Dev mode hid bugs that CI's production build showed ([[M1-07]], [[session-9]]). Before pushing, run `npm run build` in `apps/web`, then `CI=1 npx playwright test --retries=0`.

What it caught:
- A GET route handler that checks an env flag before reading the request is prerendered at build time with the flag off. Put `await connection()` first ([[route-guards]]).
- A form that streams in behind a Suspense fallback holding a copy of itself drops typed text. Stream only the dynamic part.
- A tap before hydration is sent twice (native submit, then React's replay). Submit buttons use `useHydrated()` from `apps/web/src/lib/use-hydrated.ts`.
- The suite signs up more than 30 users in 5 minutes; local `config.toml` raises the auth rate limits. Production limits live in the dashboard.
- Stale `.next/dev/types` break `npm run build` after a route moves. Start the dev server once (any e2e run) to refresh them.
- `E2E_PORT` moves the app, but sign-up and sign-in email links still point to port 3000 (the Supabase site URL). On another port those 23 tests fail on the redirect, not on the code. Free port 3000 or rely on CI ([[session-13]]).

- 2026-11-22: `CI=1` runs `next start` on whatever `.next` holds. A stale build made every payment e2e fail with a 404 on `/hire`. Run `npm run build -w @fitsphere/web` first.
