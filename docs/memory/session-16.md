---
name: session-16
type: session
description: 2026-11-23: M6-10 stage switches, audit fixes and M6-09 18+ gate merged; production at 54 of 54 migrations
updated: 2026-11-23
date: 2026-11-23
pc: welcome
---

Follows [[session-15]]. Hub: [[marketplace]]. Plan: [[decision-m6-launch]].

## Done
- PR #61, M6-10 stage switches, is merged. Hiring, chat and first checkout are closed in production now. Browsing coaches still works.
- PR #62, audit fixes, is merged. It adds security headers and money records in the data download.
- PR #63, M6-09 18+ gate, is merged. It pauses [[decision-no-age-limit]].
- Each migration went to production before its merge, with the owner's yes. Production has 54 of 54 migrations.
- Codex reviewed #63 and found no defect in the gate. A production count shows 0 accounts with an under-18 date.

## Bugs and errors
- PR #63 had a merge conflict in `packages/core/src/index.ts` after #62 removed `skillRating`. The fix keeps `isAdult` and drops `skillRating`.
- The last session did not write its session note. This note covers its three PRs.

## Needs you
- To open the marketplace for step 2, set `marketplace_open = true` in `app_settings`. That is a production change.
- Other items are in [[owner-decisions]].

## Next
The step 1 tasks in order: M6-03, M6-01, M6-02a, M6-07, M6-12. M6-11 and S0-08 wait on O-11.
