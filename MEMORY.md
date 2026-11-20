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
- **Active goal (owner, 2026-11-20):** finish M5 at zero cost, task by task (the M5-02 review fixes, M5-03, M5-04, M5-05). Tests first; Codex and /code-review high, plus /security-review for RLS, personal data, AI safety or access; one PR per task. Merge only with green CI and migrations pushed first (#49 before #50); while GitHub billing blocks CI, leave the PRs open and stacked. Fake answerer only, nothing paid. Stop on money, an account or key, an owner decision (O-07 legal, GST), or when M5 is done.
- **M5 state (2026-11-20):** every M5 task is built, reviewed (Codex, /code-review high, /security-review where it applies) and green locally, in stacked open PRs: #50 M5-01 retrieval, #51 M5-02 answer service, #52 M5-03 limit and usage log, #53 M5-04 Ask AI screen, #54 M5-05 eval set (34 questions x 3 runs, 100% on the code rules with the fake answerer). Not merged: CI is blocked by GitHub billing. M5's last check, a judge average of at least 90%, needs the owner's ANTHROPIC_API_KEY and a small spend: run `AI_PROVIDER=claude npm run eval:ai`.
- **Next step for the next session:** once GitHub Actions runs again, merge in order: #49 (payments), then #50 to #54, each with green CI and its migration pushed to production first. Regenerate the types after each. Then, with the owner's key, run the M5 judge eval.
- **Open owner decisions:** see `docs/memory/owner-decisions.md`.
- **Last session:** `docs/memory/session-13.md`.
