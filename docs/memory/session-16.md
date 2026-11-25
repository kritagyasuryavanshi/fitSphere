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

## Last part: building the approved plan
- The owner approved the plan. PR #72 (M6-15 invite gate) and PR #73 (M6-12 ops) are merged, with 20261223 and 20261224 pushed first. Production has 57 of 57 migrations.
- The Codex review of #72 found that `reserve_ai_question` let an uninvited account write rows. It now calls `require_step1`.
- A branch whose history adds a `.github/workflows` file cannot be pushed without the `workflow` scope. Squash it so that no commit touches the file.

## Building more of the plan (the stop hook asked)
- Merged #74 M6-13, #75 M6-11 code, #76 S0-08 code, #77 renewal by order (Decision 1) and #78 M4-13 manual payouts. Each migration went to production after the owner's yes. Production has 60 of 60.
- The Codex final-diff review of #77 found duplicate reminders, fixed with a sweep lock. The review of #78 found a refund-vs-payout race, fixed by refusing refunds once a payout is paid. One claimed finding was rejected: duplicate payments never get a payout.
- M6-05's perf workflow push was refused for the missing workflow scope, which confirms the block.
- CI failures from the Docker registry rate limit and port errors were not code problems. A rerun of the failed jobs fixed them.
- Lessons:
  - A prompt to `codex exec` that holds a big diff goes on stdin (`codex exec - < file`), because the argument list is too long.
  - A pgTAP statement cannot see a row that its own function call inserts.
  - Long heredocs with quotes break the Bash tool, so write such files with the Write tool.

## Reviews after the stop hook, M4-15, and try counts
- #74, #75 and #76 had merged without a review. Codex reviewed them after the merge. The fixes are in #79: Sentry now redacts id-like path parts and drops `extra`, breadcrumb data and request contexts, and the captcha token is no longer reused on retry. Rejected with reason: captcha on Google OAuth, which Supabase does not cover; the invite gate covers that path.
- #80 M4-15 client stories is merged. Codex found orphaned photos, now pruned by the cron, and photo keys missing from the export, now added.
- Tries per task (CI or review rounds before the merge; none reached the cap of 5):
  - M6-15: 2. M6-12: 2.
  - M6-13: 1, plus an infrastructure rerun. M6-11: 1.
  - S0-08: 2, plus an infrastructure rerun.
  - Renewal orders: 3. M4-13: 4, including an infrastructure rerun.
  - M4-15: 3. #79: 1.

## M4-18 (2026-11-24)
- The owner chose to build M4-18 now and leave M4-17. PR #81 is merged, with 20261229 pushed first. Production has 62 of 62.
- Suspension refunds the unused days pro rata, the only partial refund. The payout is cut by the same share, or a coach debt is recorded when it was already paid. A bounced payout drops the debt and cuts the payout instead.
- The Codex final-diff review found a deadlock risk in lock order and a stale debt; both are fixed. Tries: 4.
- Lesson: in pgTAP, row security hides other people's rows from an admin user, so run checks as the owner (`reset role`).

## M4-17 (2026-11-24)
- The owner said "stop asking and do what is best", so M4-17 was built to the agreed plan in PR #82. It is green and waits for the production push.
- pgTAP caught a real bug. In a SQL function, a column wins over a parameter of the same name, so `fits_availability(minutes)` read the window length. The parameter is now called `len`.
- The Codex review found three issues, all fixed: hold expiry at capture, with 15 minutes' grace; ended or lapsed coaching releasing future bookings; and no time change while a checkout is open. One point was rejected with reason: an expired own hold shown as free.
- Tries: 4 code runs, plus 1 infrastructure rerun after a Docker registry rate limit.
- PR #82 merged after the owner's yes. Production has 63 of 63.

## M6-05 (2026-11-24)
- The owner granted the gh `workflow` scope. The browser step must be completed, or the scope stays missing.
- The Perf workflow found the library at 75. Its skill path streamed in after an empty placeholder and pushed the list down (CLS 0.42). A loading placeholder shorter than the screen also let the footer jump. Both are fixed, and the path query now runs alongside the lesson queries. Medians: landing 88, library 90, Today 98.
- Codex: 2 points rejected with evidence. Tries: 4.

## Demo data (2026-11-24)
- At the owner's request, production has one demo coach: "Arjun Mehta (demo)", id `d0000000-0000-4000-8000-00000000c0a1`. It has 2 packages, 11 weekly slots and a 6-week demo program shown on the profile. It has no reviews, stories or client numbers, because those would be invented evidence. The account cannot sign in.
- Script: `docs/ops/demo-data.sql`. Remove before launch with `docs/ops/demo-data-remove.sql`.
- Lesson: `supabase db query --remote` needs `--yes` for writes in agent mode. Untyped literals in `union all` and enum columns need explicit casts there.

## Polish and email without a domain (2026-11-25)
- PR #84: the coach profile follows the P-Coach design. PR #85: the stats hide until a coach has a client; Find a coach drops "Hire online or in person" and says "No coaches are live yet" when no filter is set.
- The owner does not want to buy a domain yet. PR #86: emails can go through Gmail SMTP (`SMTP_USER`, `SMTP_PASS`, port 465) or Resend. Gmail wins when both are set. nodemailer is pinned at 10.5.0, because 6.x has audit findings and 10.6.1 was under two weeks old.
- Owner next: a Gmail app password into Vercel and Supabase SMTP, `NEXT_PUBLIC_SITE_URL`, Turnstile (hostname fit-sphere-xi.vercel.app) and Sentry keys, then a redeploy. After that, test sign-in and Sentry live (M6-11, S0-08).
