# fitSphere: Project Memory

This file holds only the current state. Everything else lives in the memory graph in `docs/memory/`.
Read `docs/memory/INDEX.md` next, then open only the notes the task needs.
How the graph works: `docs/memory/memory-system.md`. See the graph in the board's Memory tab: https://claude.ai/artifact/BPCG8ghatzZkV7v1haJ1z1

## Current state
- **Phase:** building. Plan and stack approved. Design system, local DB and CI done.
- **Current milestone:** M3 Coach-Led Training is done ([[M3-check]]); now M4 (marketplace) per `docs/plans/m4-plan.md`; M4-01 to M4-04 done (PRs #40 to #43). All 16 M3 tasks are done (PRs #22 to #39); reviews, fixes and the live checks are in `docs/memory/session-13.md`.
- **Open PRs:** none. Merge only after the CI run for the PR's head commit is green (`docs/memory/lesson-merge-checks-head-sha.md`).
- **Both PCs:** Docker works; local DB, pgTAP and Playwright run. WELCOME PC details: `docs/memory/env-welcome-pc.md`.
- **Next step for the next session:** M4-05 public profile and stats, then M4-06, in the order in `docs/plans/m4-plan.md`. Payment defaults (15% fee, refund terms) await the owner; payments stay in test mode. Work without asking ([[decision-autonomy]]). Email sending waits on Resend plus `NEXT_PUBLIC_SITE_URL`. Merging on green CI and review deploys production ([[decision-merge-deploys]]). Coach reads of per-program data go through `coach_reads_program`; athlete-wide data through `coach_can_read`. Production Supabase `mxrwjhdqglozdxsgtjgw` (Mumbai) has all 29 migrations (session 13); production commands need `--remote` ([[lesson-supabase-remote-flag]]). Live at https://fit-sphere-xi.vercel.app (Vercel `fitsphere`, functions in Mumbai); every push to `main` deploys production ([[env-production]]). Run `npm run db:reset` before `npm run test:db`, and e2e on a production build before pushing; `E2E_PORT` picks a free port.
- **Open owner decisions:** see `docs/memory/owner-decisions.md`.
- **Last session:** `docs/memory/session-13.md`.
