---
name: session-15
type: session
description: 2026-11-22: M4-19, M4-12 refunds and M4-14 reviews merged; plugins installed; Codex model and disk notes
updated: 2026-11-22
date: 2026-11-22
pc: welcome
---

Follows [[session-14]]. Hub: [[marketplace]].

## Done
- PR #58, M4-19 money-safe deletion, is merged after a Codex second look. Its medium finding moved to M4-18.
- PR #59, M4-12 refunds and payout reversal, is merged. Design: `docs/plans/m4-12-refunds.md`. The reviews were Codex twice, `/code-review high` and `/security-review`.
- PR #60, M4-14 verified reviews and coach replies, is merged. Design: `docs/plans/m4-14-reviews.md`. The same reviews ran.
- Each migration went to production before its merge. Production has 51 of 51 migrations.
- The `suryavanshi-claude` installer ran on this PC. The plugins ponytail, hallmark, openseo, ui-ux-pro-max and claude-seo are installed ([[tooling]]).
- The Supabase CLI on this PC is logged in and linked to production ([[env-welcome-pc]]).

## Bugs and errors
- A stale `.next` build made every payment e2e 404 under `CI=1` ([[lesson-prod-build-e2e]]).
- `/coaches/[id]` logs a Next.js "unstable value Date.now()" error while prerendering. It was already there before this session. It is on the board under M6-03.
- C: filled to about 1 GB free. Clearing the npm cache freed 1.7 GB ([[lesson-disk-full-turbo]]).

## Decisions
- An admin refund of a renewed month ends the coaching, not refunds it. A first-month refund after a renewal leaves the coaching running.
- A session payout is held until the day before the session, when its refunds close.
- A review needs a finished paid period. A review of coaching refunded later stops showing and counting.

## Needs you
- Look at two new screens: the refund confirm screen and `/coach/reviews`.
- Decide the M6 plan, and get the Razorpay test keys.
- Free space on C:.
- This ChatGPT account refuses `gpt-6-astra` for Codex, so Codex runs on `gpt-6-luna`. Update the rulebook if that is the model to keep.
- Other items are in [[owner-decisions]].

## Next
The owner decides the M6 plan. M4-15 client stories is ready but low priority.
