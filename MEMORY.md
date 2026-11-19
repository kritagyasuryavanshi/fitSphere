# fitSphere: Project Memory

This file holds only the current state. Everything else lives in the memory graph in `docs/memory/`.
Read `docs/memory/INDEX.md` next, then open only the notes the task needs.
How the graph works: `docs/memory/memory-system.md`. See the graph in the board's Memory tab: https://claude.ai/artifact/BPCG8ghatzZkV7v1haJ1z1

## Current state
- **Phase:** building. Plan and stack approved. Design system, local DB and CI done.
- **Current milestone:** M3 Coach-Led Training. Done: M3-01 to M3-12 (M3-01 to M3-10 reviewed by Codex and Claude in session 13, fixes in PR #33; M3-11 progress pages in PR #34; M3-12 coach dashboard in PR #35): programs, builder, invites, enrollments and the coach access rule, schedule, Today, the boxing player, the set logger, done summaries and metrics. M2 is done (`docs/memory/M2-check.md`). S0-06 waits on owner accounts (O-02).
- **Open PRs:** none. Merge only after the CI run for the PR's head commit is green (`docs/memory/lesson-merge-checks-head-sha.md`).
- **Both PCs:** Docker works; local DB, pgTAP and Playwright run. WELCOME PC details: `docs/memory/env-welcome-pc.md`.
- **Next step for the next session:** M3-13 athlete detail, feedback and replies (feedback table: athlete keeps it after leaving; coach reads per program). Merging on green CI and review deploys production ([[decision-merge-deploys]]). Coach reads of per-program data go through `coach_reads_program`; athlete-wide data through `coach_can_read`. Production Supabase `mxrwjhdqglozdxsgtjgw` (Mumbai) has all 29 migrations (session 13); production commands need `--remote` ([[lesson-supabase-remote-flag]]). Live at https://fit-sphere-xi.vercel.app (Vercel `fitsphere`, functions in Mumbai); every push to `main` deploys production ([[env-production]]). Run `npm run db:reset` before `npm run test:db`, and e2e on a production build before pushing; `E2E_PORT` picks a free port.
- **Open owner decisions:** see `docs/memory/owner-decisions.md`.
- **Last session:** `docs/memory/session-13.md`.
