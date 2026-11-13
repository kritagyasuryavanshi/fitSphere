---
name: M2-check
type: area
description: 2026-11-13: M2 milestone check (M2-11): evidence for each Verify item, the visual check, and leftovers
updated: 2026-11-13
---

Done in [[session-10]]. The milestone before: [[M1-check]].

## Verify line (design doc, M2)
- Browse Boxing > Technical Boxing > Jab > lesson; filter drills by equipment; save and complete, both persist after reload. Evidence: `apps/web/e2e/m2-milestone.spec.ts`, phone and desktop, production build.
- A draft lesson is not public: the same spec, plus `lesson.spec.ts` and pgTAP `content_test.sql` (anon reads published only). It is a soft 404, see [[lesson-next16-suspense]].
- Search "jab" returns the jab skill first and its drills: `search.spec.ts` and pgTAP `search_test.sql`.
- A sample shows "Sample", never "Coach-verified": `library.spec.ts`, `lesson.spec.ts`, the milestone spec.

## Workflow rules (all enforced in the database)
- Authors cannot publish; reviewers cannot publish their own item; send back needs a note ([[db]]). pgTAP `content_test.sql`, e2e `review.spec.ts`.
- Coaches write only through `save_content_draft`; pgTAP `drafts_test.sql`.

## Visual check
- Library at 390 px and lesson at 1440 px match the canvas layout: filters, tiles, path strip, dose box, steps, mistakes, safety, learn first ([[mockups]]).

## Leftovers, not blocking
- Sample tiles have no photos and no videos; founding coaches bring both.
- The "Learn" header link is marked only on `/learn/boxing`, not on S&C or gym pages.
- The review queue count badge in the coach header is not built.
- No email to the author when a lesson is published or sent back; the note shows in My lessons.
- The daily check takes up to 500 videos a run, least recently checked first.
- The video check confirms the link is a YouTube id at submit time; the daily cron catches removed or private videos.
