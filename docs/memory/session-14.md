---
name: session-14
type: session
description: 2026-11-21: M4-09a and M5-01 to M5-04 merged, the Gemini adapter, M4-10, M4-11a; M4-19 open; the disk filled up
updated: 2026-11-21
date: 2026-11-21
pc: lenovo
---

Follows [[session-13]]. Hubs: [[marketplace]] and [[ai-assistant]].

## Done
- The repo went public, so GitHub Actions runs free. PRs #49 to #57 are merged with green CI, each migration on production first. Production has 48 of 48 migrations.
- M4-09a, the payment core on a fake provider, is PR #49.
- M5-01 to M5-04 are the AI guide: retrieval, answers, the daily limit and usage log, and the Ask AI screen. They are PRs #50 to #53.
- M5-05 is the eval, in PR #54. PR #55 adds a free Gemini adapter, allowed only on local test runs.
- M4-10, in PR #56: paid coaching opens coach access with the athlete's sharing choice, coaches assign programs, and paid clients count in the stats.
- M4-11a, in PR #57: monthly renewal on a fake subscription, cancel, failed payments, the daily sweep, stopping orphaned subscriptions, and emails for each change.
- The board gained M4-11b and M4-19. Version 30 of the board artifact is published.

## Bugs and errors
- The disk filled up ([[lesson-disk-full-turbo]]). Background runs were stopped for low memory, and the local database ran out of connections.
- Locally, e2e must run against a production build: `CI=1 E2E_PORT=3100`. An old `next start` holds port 3000 ([[lesson-prod-build-e2e]]).
- A board update once pushed an invalid board, because `build_board.py | tail -1` hid the failure. It is fixed, and the check now runs without a pipe.

## Decisions
- Coaches get one day of access grace on renewal day while the subscription renews.
- Body weight stays behind invite enrollments only. The hire form's consent names training logs and sign-up answers.
- Deleting a coach whose clients have paid days to come is refused by any path.

## Needs you
- Free disk space, then let Claude rerun M4-19's e2e.
- Run the M5-05 judge in a plain PowerShell window: `$env:AI_PROVIDER='gemini'; npm run eval:ai`.
- Rotate the Gemini key that was pasted in chat.
- The other owner items are in [[owner-decisions]].

## Next
Finish PR #58 (M4-19), then M4-12 refunds.
