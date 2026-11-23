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

## Later the same session: the no-owner M6 tasks
The owner asked for a goal: finish every remaining task that needs no owner input.

### Done
- PR #64, M6-03: error pages, a route audit test (`routes.test.ts`), and coach first-run links.
- PR #65, M6-02a: full privacy and terms draft.
- PRs #67 and #70, M6-01: landing, about, help, programs and a footer. All data comes from the database.
- PR #68, M6-06: axe and keyboard e2e. They passed on the first run.
- PR #69, M6-04: manifest and code-drawn icons.
- PR #66, M6-07 write caps: merged after the owner's yes, with `20261222` pushed first. Production has 55 of 55 migrations.
- Codex reviewed the whole app for security (`gpt-6-luna`) and found nothing. `/security-review` of the write caps found nothing.

### Bugs and errors
- A page that reads the database in a public server component needs `await connection()`, or the verify build fails with "Supabase URL is missing".
- The `/coaches/[id]` prerender error came from the cookie client checking token expiry with `Date.now()` in `generateMetadata`.
- The gh token lacks the `workflow` scope, so a push that adds `.github/workflows/*` is refused.

### Decisions
- `/programs` lists only the programs coaches show on their profile. There is no public page per program, because programs are invite-only.
- Write caps sit on tables as triggers, and the service role is never capped.
- The job failure alert is a public health endpoint plus a GitHub Actions run, so it needs no secret.

### Needs you
- Run `gh auth refresh -h github.com -s workflow` so M6-12 can push. Then add the `SUPABASE_DB_URL` and `BACKUP_PASSPHRASE` secrets.
- Allow a local Lighthouse run (`npx lighthouse`) for M6-05, or wait a day for the PageSpeed quota.
- Install the app once on an Android phone and an iPhone (M6-04).
- Create a free Supabase project for previews (M6-07).

## Later still: plans discussed with Codex
- The owner asked to discuss every remaining plan with Codex until the best solution. Three rounds converged. See [[decision-remaining-plan]].
- New task M6-15 (invite gate) and owner item O-12 (Vercel Pro before step 2).
- PR #71 fixes the refund screen's session wording.
