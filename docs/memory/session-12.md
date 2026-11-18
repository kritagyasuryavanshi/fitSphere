---
name: session-12
type: session
description: 2026-11-19: WELCOME PC brought up to date; M3-02 builder, M3-03 invites, M3-04 access rule and M3-06 Today built; PRs #24 to #28
updated: 2026-11-19
date: 2026-11-19
pc: welcome
---

Follows [[session-11]]. Hub for this work: [[programs]].

## Done
- WELCOME PC caught up: 100 commits pulled, `npm ci`, local DB reset, `apps/web/.env.local` rewritten with `SUPABASE_SECRET_KEY` (as CI writes it), Playwright Chromium installed. Docker now starts at sign-in; sleep is off on AC; Windows Update paused to 2026-11-25 ([[env-welcome-pc]], [[lesson-docker-welcome]]).
- The owner works from an iPhone through Remote Control while this PC runs ([[multi-pc-workflow]]).
- M3-03 database part, PR #24, merged. Fixed first: joining needed only step 1 of sign-up. Review fixes: removed athletes cannot rejoin, the link closes when the coach deletes their account, a reset link reveals nothing, the join locks the invite row, the joined list shows active members only and needs the coach role, and the data download lists programs ([[db]]).
- M3-02 builder, PR #25, merged ([[M3-02]]). Review fixes: two-decimal loads (floating point), unpublished drills marked, "Unpublished changes" compares content, unsaved-changes warning, day order.
- M3-03 screens, PR #26, merged ([[M3-03]]). Review fixes: the join page reads the real enrollment (a `?joined=1` URL faked it), states for own program, removed and no athlete role, `lib/site-origin.ts`, `lib/programs.ts`.
- M3-04, PR #27 ([[M3-04]]): `coach_can_read`, leave and remove with confirm screens, My programs, and the athlete role on joining. Review fixes: removing someone who already left, or leaving after removal, no longer reports the wrong outcome; `remove_athlete` returns its program. /security-review found nothing exploitable on #24, #26 and #27.

- M3-06 Today, PR #28 ([[M3-06]]): versions freeze title and length; Today with the week strip, rest day and empty state; phone layout checked from screenshots. Review fixes: per-date versions, `invite_info` on today's version, no public read of `programs`, chat-pasted links, drills linked only while published, drills loaded for today only.

## Bugs and errors
- PR #24 got no CI run: it conflicted on the generated `board.html` ([[lesson-conflict-skips-ci]]).
- A PowerShell text pipeline garbled `×` and `·` in an e2e spec ([[lesson-windows-powershell-utf8]]).
- e2e locators: soft 404 status, hidden previous pages, and `sr-only` names ([[lesson-next16-suspense]]).
- Stale `.next/dev/types` from 9 November broke the first typecheck; deleting `apps/web/.next/dev` fixed it ([[lesson-prod-build-e2e]]).

## Decisions
- A rebase of a pushed branch was undone: it needs a force-push. Branches take merge commits instead.
- The builder's days are Day 1 to 7 from the athlete's start, not weekdays, to match the schedule maths.
- Two sessions on one day are allowed (morning and evening).
- Coaches see an enrolled athlete's profile, sport answers and training basics. Body metrics wait for M3-11.
- "Past feedback stays visible" moved from M3-04 to M3-13, where the feedback table is built.

## Needs you
- Merge PR #27 if it is still open, and the follow-ups in [[owner-decisions]].

## Next
1. M3-07 boxing session player or M3-08 set logger, the next ready tasks. Either adds the Start button on Today.
2. The follow-ups in [[owner-decisions]]: invite return-to after sign-in, the draft version check.
