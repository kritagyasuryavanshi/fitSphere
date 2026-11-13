---
name: session-10
type: session
description: 2026-11-13: all M1 PRs merged; M2-01 to M2-05 built, reviewed by Codex and merged one by one
updated: 2026-11-13
date: 2026-11-13
pc: lenovo
---

## Done
- PRs #1 to #11 merged. CI on `main` is green ([[ci]]).
- M2-01 content schema, PR #12: disciplines, muscles, content items, steps, links and muscle links ([[db]], [[categories]]).
  Nobody writes content rows directly. `submit_content` checks completeness. `review_content` publishes or sends back with a note, and refuses `own_item`.
- M2-02 sample content, PR #13: 14 boxing, 9 S&C and 11 gym items, all published samples, no videos. `seed_sample_content()` is idempotent.
- M2-03 library pages, PR #14: `/learn/[category]` with URL filters built from the items. `author_names()` exposes names of published authors only.
- M2-04 lesson pages, PR #15: `/learn/[category]/[slug]`, video on tap through youtube-nocookie, rep table per goal.
- M2-05 search, PR #16: `/search` and `search_content(q)` with Postgres full-text.
- Codex reviewed every PR. One P2 on M2-03 was rejected with evidence: the field it said was missing is set, and e2e covers it.

## Bugs and errors
- Next 16 Cache Components: see [[lesson-next16-suspense]].
- An old server held port 3000, and the classifier blocked inspecting it. `E2E_PORT` in `playwright.config.ts` runs e2e on another port. Magic-link specs still need 3000.

## Decisions
- The coach draft-save function moves from M2-01 to M2-08, where the editor sets its rules.
- Samples carry no video. Invented YouTube ids would embed someone else's video.
- Category rules are data: `categories.uses_supports` and `uses_muscles` drive the submit check (decision D5).

## Next
- M2-06 save and complete, then M2-08 coach editor, M2-09 review queue, M2-07, M2-10, M2-11.
