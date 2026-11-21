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
- **M5-05:** the eval is built and merged, with the free Gemini adapter in PR #55. Gemini runs only on a local test run, never on a Vercel deploy, because previews share the production database. The code rules pass 100% on the fake answerer. The judge run (average of at least 90%) is deferred by the owner on 2026-11-21: the system stopped two background runs for low memory. The Gemini judge grades its own model, so a Claude-judged run is still the independent check before Ask AI goes live. The owner pasted the Gemini key in chat, so it should be rotated.
- **M4-10 (2026-11-21, PR #56, production at 47 of 47 migrations):** paid coaching opens coach access through `engagement_opens`: active or cancelling, `share_data`, and `paid_through` at or after today. Body weight stays behind invite enrollments only (`coach_reads_body`), because the hire form's consent names training logs and sign-up answers. `assign_program` ties an enrollment to its engagement; the enrollment follows the sharing choice and ends (enrollment status `ended`) when the coaching stops. `coach_stats` counts paid clients.
- **Local e2e:** an old `next start` sits on port 3000, so run Playwright with `E2E_PORT=3100`. The disk is nearly full, which may be why background runs get stopped.
- **M4-11a (2026-11-21, PR #57, production at 48 of 48 migrations):** monthly renewal on a fake subscription. `apply_payment_event` hands `subscription.*` events to `apply_subscription_event`: charged adds the next month once (anything else is money owed back: a 'failed' renewal order plus a 'duplicate' payment); pending warns; halted lapses. `cancel_coaching` runs coaching to the end of the paid month; the reason sits in `cancel_reasons`, which the coach cannot read. The daily email cron runs `sweep_engagements` (ends run-out coaching, lapses after 7 silent days) and `stopSubscriptions` (cancels subscriptions whose coaching stopped). Coaches get one day of access grace on renewal day. Every change emails both people.
- **Pending work, 2026-11-21. The full list is in docs/memory/session-14.md.**
  - **PR #58, M4-19 money-safe deletion: open, not merged.**
    - The review fixes are pushed as c553725, and all 832 database tests pass.
    - Still to do:
      1. Free disk space ([[lesson-disk-full-turbo]]).
      2. Run `npx supabase stop` then `start`.
      3. Rerun the e2e: `CI=1 E2E_PORT=3100 npx playwright test e2e/admin-people.spec.ts e2e/money-safe-deletion.spec.ts e2e/account.spec.ts`.
      4. Get one short second review of c553725, because it changes deletion and money.
      5. Wait for green CI.
      6. Push the migration: `npx supabase db push --remote`.
      7. Merge.
  - **M5-05 judge run:** waits for the owner, at the PC.
  - **Board:** M4-12 refunds, then M4-13 payouts. M4-11b and M4-09b wait for the Razorpay test keys (O-04). M4-18 decides whether suspension cuts a coach's access at once.
  - **Owner items:** O-07 legal text, whether the fee includes GST, O-05b coach agreement wording, the Razorpay test keys, and rotating the Gemini key.
- **Next step for the next session:** finish PR #58 as listed above, then start M4-12.
- **Open owner decisions:** see `docs/memory/owner-decisions.md`.
- **Last session:** `docs/memory/session-13.md`.
