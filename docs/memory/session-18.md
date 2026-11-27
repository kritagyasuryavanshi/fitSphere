---
name: session-18
type: session
description: 2026-11-27: check of the latest update; stale memory lines fixed, email keys in .env.example, Vercel CLI linked on LENOVO, local Supabase still blocked
updated: 2026-11-27
date: 2026-11-27
pc: lenovo
---

Follows [[session-17]]. Touched: [[lesson-lenovo-local-storage]], [[env-production]].

## Checked
- CI is green on the four latest commits on main. `npm run verify` passes: 46 test files, the build and lint. The board check passes.
- Production is Ready and serves 200. PR #86 (Gmail SMTP) has no code errors.

## Fixed
- `MEMORY.md`: the phase and milestone lines, "Both PCs run pgTAP" (only the WELCOME PC does), the old merge order and active goal for PRs #49 and #50, the five M6 decisions (decided 2026-11-22), the M4-13 and M4-18 pending lines, and the 1.4 GB disk line (C: has 34 GB free).
- `session-17.md` listed the M6 plan as written that session; it was written on 2026-11-21.
- `.env.example` lists the email keys: `NEXT_PUBLIC_SITE_URL`, `SMTP_USER`, `SMTP_PASS`, `RESEND_API_KEY`, `EMAIL_FROM`.
- The runbook says to delete the SMTP pair to move from Gmail to Resend, because Gmail wins while both are set.
- `email-send.ts`: the unused `SMTP_HOST` override is gone; the host is always `smtp.gmail.com` on port 465.
- The Vercel CLI is linked on the LENOVO PC (`vercel link` at the repo root). The link wrote `.env.local` with a short-lived OIDC token; `.gitignore` already ignores it. The CLI also added a broad `.env*` rule to `.gitignore`, which was reverted.

## Found
- Production has only `CRON_SECRET`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` and `SUPABASE_SECRET_KEY`. No email, Turnstile, Sentry or site URL keys yet, so no emails send.
- M6-04 and M6-07 are rightly in progress: each waits on an owner step (a phone install test; a preview Supabase project).

## Open
- The local Supabase still fails on this PC. The freeze file and the CLI version are ruled out: [[lesson-lenovo-local-storage]].
- The 3.4.0 test pulled about 1.8 GB of new Supabase images (studio, postgres-meta). They stay, because the owner said to delete nothing here.
