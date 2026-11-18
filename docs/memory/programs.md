---
name: programs
type: area
description: M3 coach programs: builder, versions, invite links, enrollments, and the coach access rule
updated: 2026-11-19
---

Hub for milestone M3's program work. Schema in [[db]]; built in [[session-11]] and [[session-12]].

- **Programs and versions** ([[M3-01]]): one draft per program and frozen published versions. `save_program_draft` replaces the whole draft; `publish_program` freezes it and opens a copy as the next draft. The first version is live today in India; later ones from tomorrow.
- **Schedule** ([[M3-05]]): `packages/core` `programDay`, `sessionsOn`. The India date of joining is week 1 day 1, so the builder's "Day 1 to 7" counts from the athlete's start, not weekdays.
- **Builder** ([[M3-02]], PR #25): `/coach/programs`, `/coach/programs/new`, `/coach/programs/[id]`. The client keeps the whole draft and sends it as JSON; `apps/web/src/lib/program-draft.ts` mirrors `valid_prescription` (load uses the database's text rule, not floating point). "Unpublished changes" compares the draft's sessions with the live version (`sessionsKey`). The builder warns before leaving with unsaved changes and remounts after a save (keyed by `updated_at`).
- **Invites** ([[M3-03]], PRs #24 and #26): one active 32-hex code per program. `/coach/programs/[id]/invite` (copy, WhatsApp, joined list, reset with a confirm screen) and the public `/join/[code]`. Joining needs sign-in, a finished sign-up (step 2), the athlete role, and a published program with a coach; a removed athlete cannot rejoin. Link origins come from `apps/web/src/lib/site-origin.ts`.
- **Enrollments and access** ([[M3-04]], PR #27): `coach_can_read(athlete)` is the one rule for a coach reading an athlete's data: an active enrollment in a program the caller owns, plus the coach role. Policies on `profiles`, `athlete_prefs` and `athlete_basics` call it. `leave_program` (athlete), `remove_athlete` (owning coach), `my_programs()`. Screens: `/account/programs` with a leave confirm; Remove on the coach's joined list with K-ConfirmRemove.
- Later M3 tables (logs in M3-07, feedback in M3-13) must open coach reads only through `coach_can_read`. Feedback also needs an athlete-own policy, so it survives leaving ([[M3-13]] carries the pgTAP check).
- Helpers: `isUuid` and `ownProgram` in `apps/web/src/lib/programs.ts`; `coachWithProgram` and `newPage` in `apps/web/e2e/helpers.ts`.

Open follow-ups: [[owner-decisions]]. Hub: [[project-overview]].
