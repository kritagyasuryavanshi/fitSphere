---
name: session-12
type: session
description: 2026-11-19: WELCOME PC brought up to date; M3-02 to M3-04, M3-06 Today, then M3-07 player, M3-08 set logger, M3-09 summaries and M3-10 metrics; PRs #24 to #32
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
- M3-07 boxing player, PR #29 ([[M3-07]]): `session_logs` and `item_logs` written only by `log_drill` and `finish_session` for a session the caller's enrollment schedules; round timer in `packages/core`; full-screen `/session/[id]` with wake lock; Start, Continue or Done on Today. Today moved into `(athlete)/(shell)`; the player sits in `(athlete)/(player)`. Review fixes: a finished session opens on its summary, an edit from the summary returns there, sets refused until M3-08, pause and skip apply the elapsed time.
- M3-08 set logger, PR #30 ([[M3-08]]): `set_logs` (reps, kg to two decimals or bodyweight, RPE) by `log_set`, one set per call; `nextTarget` (+2.5 kg only when every planned set hit the reps); last time per exercise; 90 s rest with Add 30 s. Review fixes: floating-point loads such as 1.1 kg were refused, two blocks of one exercise merged, a partial workout raised the target.
- M3-09 summaries, PR #31 ([[M3-09]]): `/session/[id]/done` from `summarise()`; `finish_session` takes the server-stamped open time; `save_session_note` for finished sessions only. Review fixes: SQL and JS trim the note alike, the review link carries the date.
- M3-10 metrics, PR #32 ([[M3-10]]): rules in `docs/plans/m3-metrics.md`; `packages/core/src/metrics.ts`; SQL `adherence`, `hard_sets_per_muscle`, `skill_ratings` as security invoker under RLS. Review fixes: muscle bars per workout, one primary muscle per exercise (unique index), stable rating order.
- /security-review on #29 to #32: nothing exploitable found.

## Bugs and errors
- PR #24 got no CI run: it conflicted on the generated `board.html` ([[lesson-conflict-skips-ci]]).
- A PowerShell text pipeline garbled `×` and `·` in an e2e spec ([[lesson-windows-powershell-utf8]]).
- e2e locators: soft 404 status, hidden previous pages, and `sr-only` names ([[lesson-next16-suspense]]).
- PR #29 merged while CI on its last commit was pending; the run passed afterwards ([[lesson-merge-checks-head-sha]]).
- `npm run test:db` failed once after e2e had filled the database; `db:reset` first fixed it ([[lesson-prod-build-e2e]]).
- Next keeps a visited page's client state: the player reopened mid-session after finishing until it was keyed on completion ([[lesson-next16-suspense]]).
- Stale `.next/dev/types` from 9 November broke the first typecheck; deleting `apps/web/.next/dev` fixed it ([[lesson-prod-build-e2e]]).

## Decisions
- A rebase of a pushed branch was undone: it needs a force-push. Branches take merge commits instead.
- The builder's days are Day 1 to 7 from the athlete's start, not weekdays, to match the schedule maths.
- Two sessions on one day are allowed (morning and evening).
- Coaches see an enrolled athlete's profile, sport answers and training basics. Body metrics wait for M3-11.
- "Past feedback stays visible" moved from M3-04 to M3-13, where the feedback table is built.
- Logs are written only through functions that check the schedule; a coach reads them through `coach_can_read` and only for programs they own, so a note to one coach never reaches another.
- A hard set is 1+ rep at RPE 7 or more; every set logs its RPE. Adherence counts today. Records: heaviest load for 1+ rep, or most bodyweight reps; a first log is a baseline. All in `docs/plans/m3-metrics.md`.
- Sets have no rest in the prescription, so the rest timer uses 90 s with Add 30 s.
- "New best" on the gym summary moved to M3-11 (progress pages), which also needs the history.

## Needs you
- The follow-ups in [[owner-decisions]]: rest time per exercise, and the open items from earlier.

## Next
1. M3-11 progress pages (boxing and gym) and body weight, on the M3-10 functions; then M3-12 coach dashboard.
2. The follow-ups in [[owner-decisions]]: invite return-to after sign-in, the draft version check.
