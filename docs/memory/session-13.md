---
name: session-13
type: session
description: 2026-11-19: LENOVO PC caught up; Codex, Claude and Ponytail reviews of M3-01 to M3-10, nine fixes in PR #33; M3-11 progress pages in PR #34
updated: 2026-11-19
date: 2026-11-19
pc: lenovo
---

Follows [[session-12]]. Hub for this work: [[programs]].

## Done
- LENOVO PC caught up: 50 commits pulled, `package-lock.json` unchanged, local DB reset. `npm run verify` and 409 pgTAP tests passed before any change.
- The WELCOME PC has no Codex, so the M3-01 to M3-10 work (PRs #22 to #32) got its independent review here. Codex, `/code-review high` and a Ponytail review ran on the whole M3 diff.
- PR #33 fixes nine findings: coach log access per program (`coach_reads_program`), private programs (`ever_enrolled`), the published title in the data download, prescriptions without extra keys, the session time from when the player opened, the builder's leave warning after a failed save, the programs list flagging title, summary and length edits, the next target from the planned sets only, and a stable `created_at` order for skill ratings. New pgTAP `m3_review_fixes_test.sql` (8 of 12 failed before the fix); 421 pgTAP tests pass.
- `/security-review` and Codex on PR #33: no findings.
- M3-11, PR #34 ([[M3-11]]): `/progress` (boxing and S&C) and `/progress/gym` from the M3-10 functions; `records()` in `lib/progress.ts`; `log_body_weight` (one per India day, keeps the last height, locks the profile row against double saves); the coach reads body weight through `coach_can_read`; "New best" on the workout summary. Codex and `/code-review high` found 9; fixed 7, rejected 2 with evidence.

## Bugs and errors
- The first production push ran against the local stack: Supabase CLI v3 needs `--remote` ([[lesson-supabase-remote-flag]]).
- Codex's two Today findings were wrong: Today uses each date's version, and `my_programs()` has no date filter.
- Port 3000 was taken on this PC, so e2e ran on 3123 and the 23 sign-up and sign-in tests failed on the email redirect ([[lesson-prod-build-e2e]]).

## Decisions
- Body weight shows to the current coach, height too: sign-up step 3 already says "Only you and your coach see these".
- "New best" is per date, as `m3-metrics.md` defines it, and compares within a sport group (boxing with S&C, or gym), so the summary and progress page agree.
- Records load every log of the group: marked `shortcut:` in `progress-view.tsx`; move to SQL near 1,000 logs.
- Programs are not public. The old rule let anyone, even a guest, read every published program. No screen needed it, and joining goes through `invite_info`. M4 can open a deliberate public view if the marketplace needs one.
- Load validation stays in its three places (client, action, database); only the whole-number check is shared now.

## Done (hosting)
- Production Supabase project `fitSphere` (`mxrwjhdqglozdxsgtjgw`, Mumbai) created by the owner. The owner linked it from `packages\db` and pushed all 29 migrations with `--remote`. `migration list --remote` shows 29 of 29 matching.

- Vercel: the owner imported the repo as `fitsphere` (Root Directory `apps/web`). Claude installed the Vercel CLI, set the 4 variables by piping values from the Supabase CLI (none shown in chat), and redeployed: the first build had no variables and returned 500. Live site reads production data ([[env-production]]).

## Next
1. M3-12 coach dashboard (adherence board and flags), on the same M3-10 functions.
2. Hosting: the owner sets the Supabase Auth URL configuration; then test sign-in on the live site and run the Supabase security advisors once.
3. Install Codex on the WELCOME PC (`npm i -g @openai/codex`, then `codex login`), so every PR gets its review on either PC.
