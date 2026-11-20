# fitSphere: Project Memory

This file holds only the current state. Everything else lives in the memory graph in `docs/memory/`.
Read `docs/memory/INDEX.md` next, then open only the notes the task needs.
How the graph works: `docs/memory/memory-system.md`. See the graph in the board's Memory tab: https://claude.ai/artifact/BPCG8ghatzZkV7v1haJ1z1

## Current state
- **Phase:** building. Plan and stack approved. Design system, local DB and CI done.
- **Current milestone:** M3 Coach-Led Training is done ([[M3-check]]); now M4 (marketplace) per `docs/plans/m4-plan.md`; M4-01 to M4-08 done (PRs #40 to #47). All 16 M3 tasks are done (PRs #22 to #39); reviews, fixes and the live checks are in `docs/memory/session-13.md`.
- **Open PRs:** none. Merge only after the CI run for the PR's head commit is green (`docs/memory/lesson-merge-checks-head-sha.md`).
- **Both PCs:** Docker works; local DB, pgTAP and Playwright run. WELCOME PC details: `docs/memory/env-welcome-pc.md`.
- **Money terms (owner, 2026-11-20, "use the defaults"; O-05):** platform fee 15% (`fee_bps=1500`, FitSphere pays the gateway fee from it); a full refund within 7 days of the first payment, no refund on renewals, 1:1 sessions refundable up to 24 hours before; the coach payout is held 7 days. The coach agreement wording is still a draft (O-05b).
- **Owner, 2026-11-20: spend nothing for now; build payment gateways later.** GitHub Actions is blocked by billing ("payments have failed or spending limit"), so CI waits for the free minutes to reset. PR #49 (M4-09a, payment core, all four reviews resolved, all local checks green) stays open and unmerged until CI runs. Every other M4 task needs payments. Build M5 meanwhile with full-text search, which is free, and a fake answerer; the Claude API key and real calls come later.
- **Merge order for the open PRs:** #49 (payments, migration `20261209…`) and #50 (AI retrieval, `20261210…`). Merge #49 first. If #50 goes first, rename #49's migration to a later timestamp before its production push, or `db push` refuses an out-of-order migration. Regenerate `database.types.ts` after the second merge; never resolve that conflict by hand.
- **Next step for the next session:** M5-01 retrieval, then M5-02 onward with a fake answerer; merge PR #49 once CI runs again, in the order in `docs/plans/m4-plan.md`. Payment defaults (15% fee, refund terms) await the owner; payments stay in test mode. Work without asking ([[decision-autonomy]]). Email sending waits on Resend plus `NEXT_PUBLIC_SITE_URL`. Merging on green CI and review deploys production ([[decision-merge-deploys]]). Coach reads of per-program data go through `coach_reads_program`; athlete-wide data through `coach_can_read`. Production Supabase `mxrwjhdqglozdxsgtjgw` (Mumbai) has all 29 migrations (session 13); production commands need `--remote` ([[lesson-supabase-remote-flag]]). Live at https://fit-sphere-xi.vercel.app (Vercel `fitsphere`, functions in Mumbai); every push to `main` deploys production ([[env-production]]). Run `npm run db:reset` before `npm run test:db`, and e2e on a production build before pushing; `E2E_PORT` picks a free port.
- **Open owner decisions:** see `docs/memory/owner-decisions.md`.
- **Last session:** `docs/memory/session-13.md`.
