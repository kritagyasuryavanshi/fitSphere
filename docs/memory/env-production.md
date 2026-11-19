---
name: env-production
type: environment
description: 2026-11-19: production hosting: Vercel project fitsphere (Mumbai functions) on Supabase mxrwjhdqglozdxsgtjgw (Mumbai)
updated: 2026-11-19
---

Set up in [[session-13]].

- **Site:** https://fit-sphere-xi.vercel.app. Vercel project `fitsphere` in team `kritagyasuryavanshis-projects`, Root Directory `apps/web`, Git `kritagyasuryavanshi/fitSphere`, production branch `main`. **Every merge or push to `main` deploys production.**
- **Functions:** run in `bom1` (Mumbai), next to the database.
- **Database:** Supabase `fitSphere`, ref `mxrwjhdqglozdxsgtjgw`, Mumbai, Free plan. Migrations go with `npx supabase db push --remote` from `packages/db` ([[lesson-supabase-remote-flag]]).
- **Vercel variables:** `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (Production, Preview); `SUPABASE_SECRET_KEY` and `CRON_SECRET` (Production, sensitive). `NEXT_PUBLIC_SITE_URL` is unset until a real domain. `NEXT_PUBLIC_` values are baked in at build, so a change needs a redeploy.
- **Access from Claude Code:** the Vercel CLI uses the `VERCEL_TOKEN` user variable on the LENOVO PC (90-day expiry). `.claude/settings.json` puts Supabase push, link, projects and all Vercel commands on "ask", and denies remote resets and project deletion.
- **Open:** Supabase Auth URL configuration (site URL and redirect URLs) by the owner; the release gate in `TASKS.md` before real users.

Hub: [[project-overview]].
