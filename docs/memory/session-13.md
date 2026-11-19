---
name: session-13
type: session
description: 2026-11-19: LENOVO PC caught up; independent review of M3-01 to M3-10 (PR #33); M3-11 to M3-16 and the M3-15 check (PRs #34 to #39); production on Supabase and Vercel; M3 done
updated: 2026-11-19
date: 2026-11-19
pc: lenovo
---

Follows [[session-12]]. Hub for this work: [[programs]].

## Done
- LENOVO PC caught up: 50 commits pulled, `package-lock.json` unchanged, local DB reset. `npm run verify` and 409 pgTAP tests passed before any change.
- The WELCOME PC has no Codex, so the M3-01 to M3-10 work (PRs #22 to #32) got its independent review here. Codex, `/code-review high` and a Ponytail review ran on the whole M3 diff.
- PR #33 fixes nine findings: coach log access per program (`coach_reads_program`), private programs (`ever_enrolled`), the published title in the data download, prescriptions without extra keys, the session time from when the player opened, the builder's leave warning after a failed save, the programs list flagging title, summary and length edits, the next target from the planned sets only, and a stable `created_at` order for skill ratings. New pgTAP `m3_review_fixes_test.sql` (8 of 12 failed before the fix); 421 pgTAP tests pass.
- `/security-review` and Codex on PR #33: no findings.
- M3-11, PR #34 ([[M3-11]]): `/progress` (boxing and S&C) and `/progress/gym` from the M3-10 functions; `records()` in `lib/progress.ts`; `log_body_weight` (one per India day, keeps the last height, locks the profile row against double saves); the coach reads body weight through `coach_can_read`; "New best" on the workout summary. Codex and `/code-review high` found 9; fixed 7, rejected 2 with evidence.

## Bugs and errors
- The first production push ran against the local stack: Supabase CLI v3 needs `--remote` ([[lesson-supabase-remote-flag]]).
- Codex's two Today findings were wrong: Today uses each date's version, and `my_programs()` has no date filter.
- Port 3000 was taken on this PC, so e2e ran on 3123 and the 23 sign-up and sign-in tests failed on the email redirect ([[lesson-prod-build-e2e]]).

## Decisions
- Body weight shows to the current coach, height too: sign-up step 3 already says "Only you and your coach see these".
- "New best" is per date, as `m3-metrics.md` defines it, and compares within a sport group (boxing with S&C, or gym), so the summary and progress page agree.
- Records load every log of the group: marked `shortcut:` in `progress-view.tsx`; move to SQL near 1,000 logs.
- Programs are not public. The old rule let anyone, even a guest, read every published program. No screen needed it, and joining goes through `invite_info`. M4 can open a deliberate public view if the marketplace needs one.
- Load validation stays in its three places (client, action, database); only the whole-number check is shared now.

## Done (hosting)
- Production Supabase project `fitSphere` (`mxrwjhdqglozdxsgtjgw`, Mumbai) created by the owner. The owner linked it from `packages\db` and pushed all 29 migrations with `--remote`. `migration list --remote` shows 29 of 29 matching.

- Vercel: the owner imported the repo as `fitsphere` (Root Directory `apps/web`). Claude installed the Vercel CLI, set the 4 variables by piping values from the Supabase CLI (none shown in chat), and redeployed: the first build had no variables and returned 500. Live site reads production data ([[env-production]]).

- M3-12, PR #35 ([[M3-12]]): coach dashboard at `/coach` with stat tiles, flags (`coachFlags` in `lib/coach-flags.ts`) and the weekly board; phones get stacked cards. Codex and `/code-review high` found 9; all fixed: 1,000-row cap, rejoined athletes, stale flags, wording, program on flag cards. Pain flag has no source until M5.
- The owner approved merging on green CI and review, which deploys production ([[decision-merge-deploys]]). Sleep is off on AC power on the LENOVO PC.

- M3-13, PR #36 ([[M3-13]]): `feedback` and `feedback_replies` (write only through `give_feedback` and `reply_feedback`; read-only grants), the coach athlete page `/coach/athletes/[enrollment]`, Coach feedback `/account/feedback`, the newest feedback on Today. Replies close once the athlete leaves. Security review: no findings; Codex and two `/code-review high` passes: fixed 12. Migration pushed to production with the owner's approval before the merge; 30 of 30 match.
- C: filled up (391 MB free): Docker went read-only. CI ran the database tests meanwhile; types came from CI's diff. After the owner freed space, a full `wsl --shutdown` was needed to clear the read-only disk ([[lesson-docker-welcome]]).
- S0-06 done in practice: Vercel builds a preview for every PR.

- M3-14, PR #37 ([[M3-14]]): `email_prefs` switch, `give_feedback` queues the email, `claim_emails` claims atomically (10-minute rest, 5 tries, 7-day staleness, switches checked at sending), `lib/email.ts` and `lib/email-send.ts` (Resend with an idempotency key, paced, 10 s timeout, only with `RESEND_API_KEY`, `EMAIL_FROM` and `NEXT_PUBLIC_SITE_URL`). Codex 2 and `/code-review high` 10 findings, all fixed. Migration pushed before the merge; 31 of 31 match.
- The owner asked for full autonomy ([[decision-autonomy]]) and a showcase and sellable version: estimate about 1 week to a demo, 2 to 3 weeks to selling to coaches by hand.

- M3-16, PR #38 ([[M3-16]]): `notifications` (own rows, read-only grants) from triggers (feedback, a coach's new lesson) and `queue_session_reminders` (daily cron at 08:30 India time, once per athlete per day, every session named); `/account/notifications` with unread marks, Mark all as read and three email switches (reminders start off); `email_wanted` decides at queueing and sending; a reminder email only goes out on its own day. Security review: no findings. Codex's one finding was wrong (it read 03:00 UTC as 08:30 UTC); `/code-review high` found 6, all fixed. 32 of 32 migrations on production.
- The owner moved every "ask" rule to "allow" and added the `--db-url` deny; committed so both PCs share it.

- M3-14 after merge: `/security-review` of PR #37 (email_prefs, claim_emails, give_feedback email, Resend sender, cron): no findings. Live check: `/account/feedback` loads; `/api/cron/send-emails` returns 401 without the secret.
- Final M3 production check: 4 new tables, 8 functions and 2 triggers present; RLS on notifications; /account/notifications, /account/feedback, /coach, /progress/gym and /legal/privacy load; the menu links only to real pages.
- Live e2e: `links.spec.ts` run against https://fit-sphere-xi.vercel.app (temporary config, no web server, read-only): 4 of 4 pass on desktop and phone. Signed-in e2e cannot run against production by design: it signs in through `/auth/confirm`, which is off unless `E2E_AUTH_CONFIRM=1` (only the Playwright web server sets it), because enabling it in production would be a sign-in bypass. So signed-in journeys run on a production build locally and on CI.
- Process miss: M3-14's `/security-review` ran after its merge, not before (no findings). Lesson: for every PR that touches RLS, grants or security-definer functions, start `/security-review` together with Codex and `/code-review`, before the merge.
- M3-15, PR #39: the M3 milestone check passed; M3 is done ([[M3-check]]). Live-site QA fixed dead menu links, added privacy and terms pages (they match what coaches can actually read), `/learn`, and a contrast failure.

- M4 started. The owner chose to build the full plan (M4, M5, M6) instead of the demo detour. The planner wrote `docs/plans/m4-plan.md`: engagements replace hire_requests; access follows `paid_through`; `apply_payment_event` is the only writer of money state; payouts are held until the refund window closes; about 75% is buildable with a fake provider.
- M4-01, PR #40: coach_profiles, packages, availability_slots, credentials and a private `credentials` bucket. Column grants keep the payout account, the agreement and the client limit away from clients; live means published and still holding the coach role. Supabase refuses SQL deletes on storage.objects, so `deleteAccount` removes credential files through the Storage API. Security review, Codex and `/code-review high` all ran before merge; 12 findings fixed; a second security look at the fixes found nothing. 33 of 33 migrations on production.

- M4-03, PR #41: `/coach/credentials` (direct browser upload into the private bucket, because Vercel caps server requests at about 4.5 MB) and `/admin/credentials` (X-Verify, 10-minute signed links). `decide_credential`: admins only, never their own, a reject needs a note, every decision in `audit_log`. A pending or checked credential's file is locked (`credential_file_locked` in the storage delete policy); `withdraw_credential` and Remove free it; account deletion withdraws first. All three reviews before merge; 9 findings fixed; a second security look found nothing. 34 of 34 migrations on production.
- Subagent rate limit hit at the end of the day (resets 00:30 IST).

- M4-02, PR #42: `/coach/profile` (X-CoachProfile) with packages in rupees, weekly slots, the coach agreement (a plain draft, version `draft-2026-11`, pending owner item O-05) and Go live; credentials moved to `/coach/profile/credentials`; `/coaches/[id]` is the first public profile. Going live needs the current agreement, a headline and a live package, and a live profile keeps them (`assert_live_ready`). `coach_is_live` needs the current agreement, so a version bump hides coaches until they accept again; `coach-agreement.test.ts` pins the text to its version. `my_coach_profile` never returns the payout account. All three reviews before merge; 9 findings fixed. 35 of 35 migrations on production.
- Lesson: `npm run verify` can fail locally when typecheck and build race on `.next/types`; rerun it alone before treating it as a real failure.

- M4-04, PR #43: `/coaches` (P-Coaches). `find_coaches` (definer, anon) lists live coaches with 8 filters and fixed sort keys only (best, rating, price, checked); any other key is refused, so rank can never be bought. `coach_filter_options` gives every live coach's specialties, cities and languages. Rating is empty until M4-14 redefines `find_coaches`. A price range matches any live monthly package. `FilterForm` now auto-submits choices only, so typed fields wait for the button. Coaches is in the header and the phone menu. 36 of 36 migrations on production.
- Fixed the verify race for good: in turbo.json, build depends on typecheck in the same package.
- Lesson: the production `db query --read-only` role cannot run anon-granted functions (42501); check those through the live site.

- M4-05, PR #44: `coach_stats` (definer, anon) gives athletes coached, programs finished, stayed 3+ months and average adherence from enrollments and logs. Finished means the enrollment ran past its last day with at least half its sessions done. The percentages need 5 athletes and show to the nearest 10%. `/coaches/[id]` shows the stats, a portfolio of published lessons, an empty reviews section and years marked self-reported. 37 of 37 migrations on production.
- Decision: programs stay off the public profile. They are invite only (M3), and a program made for one client can name them in its title. New task M4-05b lets a coach choose to list a program.
- Lesson: a public aggregate needs a floor and rounding. 3 people let 0% or 100% show each person's outcome, and day-to-day changes show a newcomer's.

## Next
1. M4-06 shortlist and compare, then M4-07 hire, accept and decline.
2. The demo work: demo accounts with realistic data and one-click entry, then a domain and Resend (owner).
2. Then M4 (marketplace) only once coaches pay by hand, per the owner's sell-to-coaches-first plan.
2. Hosting: the owner sets the Supabase Auth URL configuration; then test sign-in on the live site and run the Supabase security advisors once.
3. Install Codex on the WELCOME PC (`npm i -g @openai/codex`, then `codex login`), so every PR gets its review on either PC.
