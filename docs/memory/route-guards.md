---
name: route-guards
type: area
description: 2026-11-12: how protected routes are guarded (M1-05), and the rules every new page must follow
updated: 2026-11-12
---

- Every page, route handler and server-action file under `(athlete)`, `(coach)` or `(admin)` awaits `requireRole(role)` from `apps/web/src/lib/viewer.ts` first. `guards.test.ts` fails the build if one does not ([[M1-05]]).
- Layouts only draw shells. Next 16 does not re-run layouts on navigation, so a layout check is no guard.
- `readAccount` is the one reader of sign-up state and roles. Sign-up is done after step 2 ([[M1-04]]); a failed read throws.
- A guest goes to `/sign-in`, an unfinished sign-up to its next step, a missing role to `/not-allowed`.
- `/auth/confirm` is test-only (`E2E_AUTH_CONFIRM=1`, set by Playwright). Owner decision before real emails use it: add a "Continue" page that POSTs, to stop login CSRF ([[owner-decisions]]).
- The proxy matcher needs `\.` in the string. A single backslash once made the proxy run only on `/`; `proxy.test.ts` guards it.
- e2e signs users in with `signInAs` / `createUser` in `apps/web/e2e/helpers.ts`, through the admin API. No email, no rate limit.
