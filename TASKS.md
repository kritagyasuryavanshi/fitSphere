# fitSphere: Tasks

Build tasks live on the board: `docs/plans/board.json` (rendered at https://claude.ai/artifact/BPCG8ghatzZkV7v1haJ1z1). This file keeps owner-level items only.

## Now
- [ ] Owner: in `/permissions` add Deny `Bash(npx supabase db reset --db-url*)` and `Bash(npm run db:reset* --linked*)`; then let Claude commit `.claude/settings.json` so the WELCOME PC gets the same rules. Delete the stray `.claudesettings.json`.
- [ ] Owner: install Codex on the WELCOME PC (`npm i -g @openai/codex`, then `codex login`), so every PR gets its independent review on either PC. PRs #22 to #32 had none until session 13.
- [ ] Owner: rotate the GitHub token, because it appeared in the chat.
- [ ] Owner: push the `suryavanshi-claude` rulebook commit that brings Codex back (the push from LENOVO gets 403).
- [ ] Owner: push the rulebook, and switch off unused plugins. The tooling audit lists the steps: https://claude.ai/artifact/NAWsRxJUah4godqxBrXA6T.
- [ ] Owner: Supabase → Authentication → URL Configuration: Site URL `https://fit-sphere-xi.vercel.app`; Redirect URLs `https://fit-sphere-xi.vercel.app/**` and `https://*-kritagyasuryavanshis-projects.vercel.app/**`. Anthropic API and Google OAuth still to create (O-02). This blocks preview deploys (S0-06) and Google sign-in.
- [ ] Owner: answer Q-01 to Q-15 in `docs/architecture/risks-and-gaps.md`, or accept the defaults (O-09).
- [ ] Owner: decide on branch protection for `main`. It needs GitHub Pro (paid) or a public repo. Until then, merge only on a green CI run.
- [ ] Owner: meet one boxing coach and one S&C coach this week (the assignment in the design doc).

## Next
- [ ] Release gate, before sign-in goes live: turn on "Confirm email" in the hosted Supabase project, set custom SMTP, add Turnstile CAPTCHA to sign-in, set `NEXT_PUBLIC_SITE_URL`, list only our own domains in the redirect allow-list, and set auth rate limits in the dashboard (local config raises them for tests).
- [ ] Release gate, video check (M2-10): set `CRON_SECRET` in Vercel, confirm the daily cron in `apps/web/vercel.json` shows in the Vercel project, and set `SUPABASE_SECRET_KEY` for the route.
- [ ] Owner, before M4 (marketplace): confirm the payment provider (recommended Razorpay), set the fee %, refund and cancel terms, register the business and GST, and sign a coach agreement.
- [ ] Owner: decide on nutrition for fat-loss users (meal plans or calorie targets are out of v1 for now).

## Next (design)
- [ ] Owner: decide on Mobbin (optional).

## Done
- [x] 2026-11-19: M3-12 coach dashboard (PR #35), live on production.
- [x] 2026-11-19: Vercel project `fitsphere` live at https://fit-sphere-xi.vercel.app on production Supabase.
- [x] 2026-11-19: Production Supabase project `mxrwjhdqglozdxsgtjgw` (Mumbai) created; all 29 migrations pushed.
- [x] 2026-11-19: M3-11 progress pages, body weight log and New best (PR #34).
- [x] 2026-11-19: M3 review on LENOVO (Codex, Claude, Ponytail): nine fixes merged, incl. coach log access per program and private programs (PR #33).
- [x] 2026-11-19: M3-07 to M3-10: boxing player, set logger, done summaries and metrics (PRs #29 to #32).
- [x] 2026-11-19: M3-02 to M3-04 and M3-06: builder, invites, enrollments, Today (PRs #24 to #28).
- [x] 2026-11-13: M2 Library done: save and complete, skill path, coach editor, review queue, daily video check, milestone check (PRs #17 to #21).
- [x] 2026-11-13: M2-01 to M2-05: content schema, sample content, library, lesson pages and search (PRs #12 to #16).
- [x] 2026-11-13: PRs #1 to #11 merged; CI on main green.
- [x] 2026-11-13: Coach applications (M1-07, PR #10) and account with consents, download and delete (M1-08, PR #11).
- [x] 2026-11-12: App shells and route guards (M1-05, PR #8); admin people and roles (M1-06, PR #9).
- [x] 2026-11-12: Sign-up steps 1 to 4 (M1-03, M1-04; PRs #6, #7). No age limit; two AI consents with explicit yes/no.
- [x] 2026-11-12: Sign in with an email link or Google (M1-02, PR #5), reviewed by the planner, /code-review, a security scan and Codex.
- [x] 2026-11-12: /code-review high on M1-01; review fixes pushed to PR #4, CI green.
- [x] 2026-11-12: Identity schema with RLS, reviewed by the planner and /security-review (M1-01, PR #4).
- [x] 2026-11-12: Playwright e2e harness with seeded test users; e2e CI job (S0-07, PR #3).
- [x] 2026-11-12: Memory graph in `docs/memory/` with a Memory tab on the board (PR #2).
- [x] 2026-11-12: Installed Bun (gstack works) and the Codex CLI.
- [x] 2026-11-12: CI on GitHub Actions: verify and database jobs on every PR and push to main (S0-05, PR #1).
- [x] 2026-11-09: Local Supabase, migrations, pgTAP and typed client in `packages/db` (S0-04).
- [x] 2026-11-09: Design tokens and base components in `packages/ui` (S0-03).
- [x] 2026-11-05: Owner approved the plan, board and stack; Node upgraded.
- [x] 2026-11-05: Engineering plan and 79-task build board (setup plus M1 to M6).
- [x] 2026-11-05: Coach Marketplace designed, Phase 2 (11 new screens plus new Coaches and Coach profile, desktop and phone).
- [x] 2026-11-05: Gym & Fitness category designed (7 new screens, desktop and phone).
- [x] 2026-11-05: Phone versions of all screens (48) and the review fixes.
- [x] 2026-11-05: Full-site linked design, 47 screens (`docs/mockups/`).
- [x] 2026-11-04: Fight Camp mockups, 10 screens with demo data (`docs/mockups/`).
- [x] 2026-11-04: Compare 3 visual directions; owner chose Fight Camp.
- [x] 2026-11-04: Move the project folder to the Desktop.
- [x] 2026-11-04: Approve the v1 design doc (`docs/designs/fitsphere-v1.md`).
- [x] 2026-11-04: Save the full product brief (`docs/PRODUCT_BRIEF.md`).
- [x] 2026-11-04: Create the repo, scaffold the docs, and push to GitHub.
