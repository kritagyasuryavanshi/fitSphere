# fitSphere: Tasks

Build tasks live on the board: `docs/plans/board.json` (rendered at https://claude.ai/artifact/BPCG8ghatzZkV7v1haJ1z1). This file keeps owner-level items only.

## Now
- [ ] Owner: merge PR #1, then #2, #3, #4 and #5.
- [ ] Owner: rotate the GitHub token, because it appeared in the chat.
- [ ] Owner: push the `suryavanshi-claude` rulebook commit that brings Codex back (the push from LENOVO gets 403).
- [ ] Owner: push the rulebook, and switch off unused plugins. The tooling audit lists the steps: https://claude.ai/artifact/NAWsRxJUah4godqxBrXA6T.
- [ ] Owner: create Supabase, Vercel, Anthropic API and Google OAuth accounts (O-02). This blocks preview deploys (S0-06) and Google sign-in.
- [ ] Owner: answer Q-01 to Q-15 in `docs/architecture/risks-and-gaps.md`, or accept the defaults (O-09).
- [ ] Owner: decide on branch protection for `main`. It needs GitHub Pro (paid) or a public repo. Until then, merge only on a green CI run.
- [ ] Owner: meet one boxing coach and one S&C coach this week (the assignment in the design doc).

## Next
- [ ] Release gate, before sign-in goes live: turn on "Confirm email" in the hosted Supabase project, set custom SMTP, add Turnstile CAPTCHA to sign-in, set `NEXT_PUBLIC_SITE_URL`, and list only our own domains in the redirect allow-list (M1-02 review).
- [ ] Owner, before M4 (marketplace): confirm the payment provider (recommended Razorpay), set the fee %, refund and cancel terms, register the business and GST, and sign a coach agreement.
- [ ] Owner: decide on nutrition for fat-loss users (meal plans or calorie targets are out of v1 for now).
- [ ] Build M1 Foundation after the S0 setup tasks.

## Next (design)
- [ ] Owner: decide on Mobbin (optional).

## Done
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
