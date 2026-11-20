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
- **State (2026-11-21):** the repo is now public (owner's choice, after a history scan found no secrets), so GitHub Actions runs free. PRs #49 to #54 are merged with green CI, each migration pushed to production first: M4-09a payment core, then M5-01 to M5-04. Production has 45 of 45 migrations. Live checkout stays closed (no provider, and the fake-payment guard is off in production), and Ask AI stays off (no AI_PROVIDER in production).
- **M5-05:** the eval is built and passes 100% on the code rules with the fake answerer. The judge (average of at least 90%) still needs a real model. The free route is a Gemini adapter on local branch `m5-06-gemini`, not yet committed or PR'd; it adds a free-tier key in apps/web/.env.local and is allowed outside production only. The first Gemini eval run was stopped by the system for low memory. The owner pasted that Gemini key into chat, so it should be rotated.
- **Next step for the next session:** commit and PR the Gemini adapter (m5-06-gemini, rebased onto main), run `AI_PROVIDER=gemini npm run eval:ai` with memory to spare, and mark M5-05 done if the judge average is at least 90%. M4-09b and later need Razorpay test keys.
- **Open owner decisions:** see `docs/memory/owner-decisions.md`.
- **Last session:** `docs/memory/session-13.md`.
