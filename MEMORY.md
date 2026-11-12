# fitSphere: Project Memory

This file holds decisions, their reasons, and the current state.
Every session reads it first and updates it before it ends.
Keep newest entries at the top of each section.

## Current state
- **Phase:** building. Plan and stack approved. Design system done.
- **Current milestone:** S0 Setup. S0-01 to S0-05 are done.
- **Next step for the next session:** S0-07 (Playwright harness) or M1-01 (identity schema). Both are unblocked. O-02 is still needed for S0-06 and for Google sign-in.
- **Open owner decisions:** branch protection for `main` (needs GitHub Pro or a public repo; until then merge only on green CI), O-02 accounts (blocks S0-06), O-09 (answer Q-01 to Q-15 or accept the defaults). Also O-04 to O-08. Mobbin install (only unofficial community MCPs exist; needs a paid Mobbin account and a session token; owner must say "install mobbin-mcp").
- **Owner's parallel task:** meet one boxing coach and one S&C coach (the assignment in the design doc).

## Session 6 (2026-11-12): back on the LENOVO PC, S0-05
- This PC: Node 26.13, npm 11.20, git, WSL, `gh` logged in. No Docker, so `db:start` and `test:db` do not run here; the CI `db` job covers them. `node_modules` was stale after the pull; run `npm ci` after pulling on a PC that has been idle.
- S0-05 done: `.github/workflows/ci.yml` runs `verify` (typecheck, lint, test, build) and `db` (Supabase start, pgTAP, generated-types check) on every PR and push to main. First run green on PR #1.
- Pushing workflow files needs the `workflow` scope: `gh auth refresh -h github.com -s workflow`, then `gh auth setup-git` so git uses the gh token, not Git Credential Manager.
- GitHub Free cannot protect branches on a private repo (API 403). Auto mode blocks Claude from merging PRs itself; the owner merges.

## Session 5 (2026-11-09): new PC, S0-03
- Owner moved to a second PC: repo cloned to `C:\Users\WELCOME\fitSphere`. Session transcripts stay on the old PC; repo docs and artifacts carried the context. This PC has Node 22.19, npm 11.6 and Docker 29, so local Supabase is possible here. `gh` installed with winget, at `C:\Program Files\GitHub CLI\gh.exe`, logged in as `kritagyasuryavanshi`. Bun and Codex CLI were not checked here.
- S0-03 done: `packages/ui` with tokens, Button, Tag, Input, Checkbox, RadioCard, Tabs, Dialog. Link buttons use `buttonClass()` with `next/link`. Tailwind reads the package through `@source` in `apps/web/src/app/globals.css`.
- Added beyond the board's list: a `danger` Button, because the confirm screens use it, and a Dialog `alert` mode that keeps focus off the destructive button.
- Checkbox cards from A-Onboard1 are not built yet; add them in M1-03, where they are first used. Pill-style category links (C-Library) are links rather than tabs; build them in M2-03.
- The real-browser check (axe with contrast, measured sizes, focus rings, dialog keyboard behaviour at 390 and 1440 px) ran as a one-off script, so nothing in CI runs it yet. Move it into Playwright at S0-07. It found one bug jsdom could not: default buttons were 52 px, not 48 px.
- Vitest upgraded to 5 across the workspace; that cleared the two critical audit advisories. Moderate advisories remain through typescript-eslint and eslint-config-next (dev only). Not fixed: the suggested fix is breaking.
- S0-04 done: `packages/db` holds the Supabase project, migrations, pgTAP tests, generated types (`npm run db:types`) and `createDbClient`. Commands from the repo root: `db:start`, `db:stop`, `db:reset`, `test:db`. Studio is at http://127.0.0.1:54323. `apps/web/.env.local` holds the local keys and is git-ignored; recreate it from `npx supabase status` in `packages/db`.
- O-02 is no longer a dependency of S0-04 (owner approved 2026-11-09): local Supabase needs Docker, not a cloud account.
- Analytics is off in `supabase/config.toml`: nothing uses it, and it took 559 MB on this 8 GB PC. Its log shipper, vector, also restart-looped here.
- WELCOME PC setup, hard won: C: has little space, so Docker's storage is on `D:\Docker`, and npm's cache was cleared to fit WSL. If WSL install fails with 1603, check disk space in the installer log. If Docker shows "exec format error" after a first `supabase start`, images unpacked with empty programs during the parallel pull: remove the Supabase images and `docker pull` them one at a time. Docker Desktop does not always start on its own after a restart.
- Mockup typo, left alone: the confirm screens' warning icon path reads `M12 3l10 28H2z`, and the correct shape, used in `packages/ui`, is `M12 3l10 18H2z`.

## Session 4 (2026-11-05): build starts
- Owner: "start building with the build board; use the best stack you recommend; keep it scalable, I will add more categories and features later." Plan and stack approved (S0-01, O-01 done).
- Stack locked: monorepo (npm workspaces + Turborepo): apps/web (Next.js App Router, TS strict), packages/core (pure rules, metric-type registry), packages/ui (Fight Camp design system), packages/db (Supabase migrations, types, pgTAP), packages/config. Supabase Mumbai, Razorpay, Claude. Categories are data; metric types are a registry; features are modules; feature flags table. Details: architecture.md §5.
- Node 26.13.0 LTS installed with winget (O-03 done).
- Build inside the repo, not in a temp folder (owner rejected a scratchpad scaffold).
- Docker is not installed, so local Supabase (S0-04) needs Docker Desktop or a cloud dev project.
- Done: S0-02 (c6cdf8f). Next: S0-03 design system in packages/ui. Next.js 16 notes read: fonts via next/font/google (Anton, Inter) in the root layout; Tailwind 4 via @import "tailwindcss" with @theme tokens. gstack /verify needs Bun; use `npm run verify` instead.

## Session 3f (2026-11-05)
- Owner approved D1–D6. Done: titles fixed; five key phone screens reviewed from real screenshots and fixed via `phone.py` (2-up photo tiles, collapsed filters and AI history, sticky bars above tabs); coach dashboard, my lessons and clients become cards on phones; 9 new screens for G1–G4, G6 and notifications (`build/pages_gaps.py`). Record: `docs/designs/design-review-2026-11-05.md`; review page with screenshots: https://claude.ai/artifact/DnbZRbQHPG74SwxnUg5Mft. Screenshots in `docs/mockups/screenshots/`.
- Screenshot tool: playwright-core with the installed Chrome (scratch `shots/shots.js`); it sizes the window to the full page so sticky bars sit at the true bottom.
- Board 85 tasks: O-10 done; M4-17 and M4-18 unblocked; new M3-16 (in-app notifications). Still open: G5 invoices, G7 email templates, G8 offline page.
- M1 does not start until the owner reviews these design changes.

## Session 3e (2026-11-05)
- Pre-implementation analysis saved in `docs/architecture/`: product-analysis.md (roles, 12 feature areas, journeys J1–J15, assets, design observations D1–D6), architecture.md (route map, components, backend modules, endpoints, ERD, conventions), risks-and-gaps.md (risks R1–R16, questions Q-01–Q-15, missing screens G1–G8). Rendered page: https://claude.ai/artifact/NuWTJNJ1GZsYCznVN8CDWk (rebuild with `python docs/architecture/build_page.py`).
- Board now 84 tasks: added O-09 (answer Q-01–Q-15), O-10 (approve D1–D6), S0-08 (analytics and errors), M4-17 (1:1 booking, blocked: no design), M4-18 (reports and moderation, blocked: no design).
- Rule: no design edits without owner approval (O-10). Nothing implemented.

## Session 3d (2026-11-05)
- Coach Marketplace moved into v1 as M4 (owner decision). AI is M5, launch M6.
- Engineering plan: `docs/plans/engineering-plan.md`. Build board: `docs/plans/board.json` (source of truth), rendered by `python docs/plans/build_board.py` to `board.html`, published at https://claude.ai/artifact/BPCG8ghatzZkV7v1haJ1z1. Republish after every task.
- Working loop: one task in progress at a time; tests first; `npm run verify` plus the task's end-to-end test; mark done with date and commit; re-render and republish the board. Codex review at the end of each milestone for auth, RLS, payments, migrations.
- Plan assumes Next.js only + Supabase (Mumbai) + Razorpay + Postgres full-text retrieval for AI. Waiting for owner approval (board task S0-01).
- Walkthrough page: https://claude.ai/artifact/217yXiVPoycExyuUg6haex.

## Session 3c (2026-11-05)
- Added Gym & Fitness as a third category (S&C kept as its own): gym library `G-Library` by goal and muscle group, bench press exercise page with rep ranges per goal, Muscle Builder program, gym Today (persona Neha), workout player with last-time numbers and overload target, workout done, gym progress (sets per muscle, body weight, records), sign-up gym-goal step (sign-up is now 4 steps). Landing gets a gym section.
- 10 new gym photos from Unsplash in `docs/mockups/images/` (credits updated). Unsplash search API refuses scripts; download by known photo ID from images.unsplash.com works.

## Session 3b (2026-11-05)
- Applied the ponytail review fixes: build runs from the repo (`python docs/mockups/build/build.py`), one-off patch block removed, real disabled buttons, confirm screens for delete account / reset invite / remove athlete, proper list markup.
- Added phone versions of every screen (`M-*.dc.html`, 390 px) on a new canvas page "Phone · full site". `phone.py` converts each desktop board: phone headers, bottom tabs (athlete: Today/Learn/Progress/Ask AI; coach: Athletes/Programs/Lessons/Review), a visitor menu screen, phone-to-phone links.
- Board heights are measured in headless Chrome during the build. Note: headless Chrome cannot go below 500 px wide, so overflow checks need the fixed 390 px root.
- Rule: canvas edits win. Before a rebuild, compare the canvas version and port hand edits into the sources.

## Session 3 (2026-11-05)
- Owner asked for every site screen as a linked design (UI/UX, not a working app). A half-written prototype app in `docs/prototype/` was deleted unused.
- Added 37 screens to the canvas and rewired the original 10, so Play from Landing clicks through every flow: public site, learn, sign-up (with under-18 branch), train, account, coach, review, admin, and 3 phone screens.
- Sources in `docs/mockups/`; generator scripts in `docs/mockups/build/` (Python, writes `.dc.html` from shared header/footer fragments).
- Installed tools: ponytail plugin, ui-ux-pro-max plugin, hallmark skill (global, via a temporary Node 22 because PC Node is 18.16).
- Hallmark used as a quality floor only: focus rings, 44px targets, active/disabled states, no invented metrics (removed "24 skills · 96 drills" and "1,284 athletes learning"), no em-dashes in copy. Its Floor rules 48/54/63 conflict with the canvas format and the approved Fight Camp voice, so they stay unmet by owner choice. ui-ux-pro-max style picks (orange, dark neon) rejected; its UX rules used (empty states, inline errors, destructive confirms).

## Session 2 (2026-11-04, later)
- Moved the project to `C:\Users\LENOVO\Desktop\Projects\fitSphere`.
- Built 3 visual directions (Studio/Apple, Coach/Airbnb, Fight Camp/Nike), 3 screens each. Owner chose Fight Camp.
- Built the full Fight Camp set: 10 screens with demo data and 20 Unsplash photos. Canvas: https://claude.ai/artifact/YVnwgT8qzwA2SerCSPasBe (page "Fight Camp v1"). Sources in `docs/mockups/`; photo credits in `docs/mockups/images/CREDITS.md`.
- Demo people (fictional): coaches Vikram Rathore (boxing), Ananya Iyer (S&C), Rohan Desai (reviewer); athlete Kabir Malhotra. Real coach photos must replace the Unsplash models before public launch.
- GitHub pushes sometimes fail with "Internal Server Error"; a retry a few seconds later works.

## Session 1 (2026-11-04)
- Created the repo, the docs scaffold, and the private GitHub remote.
- Saved the owner's full brief to `docs/PRODUCT_BRIEF.md`.
- Ran /office-hours in startup mode. Approved design: `docs/designs/fitsphere-v1.md`. Cross-session copy: `~/.gstack/projects/kritagyasuryavanshi-fitSphere/`.
- One independent review round found 6 blocking issues, all fixed. 4 minor concerns stay open for the plan.
- Environment: `gh` CLI is installed and logged in as `kritagyasuryavanshi`. Bun and the Codex CLI are not installed. gstack was upgraded to v1.95.5.0, but its setup step failed for lack of Bun.
- The owner's preference: answer with a decision and move on. Avoid long question chains. The owner skipped several multi-question prompts.

## Decisions
| Date | Decision | Why |
|---|---|---|
| 2026-11-05 | Coach Marketplace is in v1 as milestone M4 (discover, compare, shortlist, hire, chat, pay, payouts, verified reviews, coach clients and earnings, admin credential checks). AI becomes M5, launch M6. Payment provider recommended: Razorpay with Route (owner to confirm). | Owner: "add marketplace in v1". Risks recorded: empty marketplace before about 20 coaches, payments milestone size, credential checks, client-story consent. |
| 2026-11-05 | Three categories, each with its own library: Boxing, Strength & Conditioning (S&C for boxers, unchanged), Gym & Fitness (build muscle, lose fat, get stronger, get fitter). Gym is a full category, not boxing support. | Owner asked for gym training (weight loss, muscle building, hypertrophy), then asked to keep S&C as its own category too. |
| 2026-11-05 | No meal plans or calorie targets in v1. Body weight optional, consent-gated for AI. | Nutrition advice is out of v1 scope and is health data. Open question for the owner. |
| 2026-11-05 | Keep Fight Camp look when using Hallmark or ui-ux-pro-max; use them for quality checks, not a new theme. | Owner said the current screens look good and to follow that practice. |
| 2026-11-04 | Visual direction: "Fight Camp" (Nike-grade): Anton condensed caps + Inter, black/white, volt #D4F000 accent, square imagery, pill buttons. 10 screens in `docs/mockups/` and the canvas https://claude.ai/artifact/YVnwgT8qzwA2SerCSPasBe. | Owner picked C over Studio (Apple) and Coach (Airbnb). |
| 2026-11-04 | v1 = three pillars: Video Learning Library, AI Instructional Assistant, Coach-Led Training. | Owner wants all three complete from day one and accepts a longer timeline. |
| 2026-11-04 | Launch sports: Boxing primary, S&C integrated support. Data model stays multi-sport. | Owner's choice. Both suit adults. S&C must not become a generic gym app. |
| 2026-11-04 | Coach-led content: coaches author, a reviewer publishes, nobody approves their own item. | Content quality and cold start are the main risks. Coaches bring content and athletes. |
| 2026-11-04 | AI answers cite published, non-sample content. With no match, AI explains concepts only and never prescribes. | Brief requires AI grounded in approved content and kept apart from coach-verified content. |
| 2026-11-04 | Adults only (18+) in v1. | India's DPDP Act needs verifiable parental consent for minors. Deferred to the academy phase. |
| 2026-11-04 | Mobile-first PWA on Next.js + Vercel + Supabase. YouTube embeds for video. | House default stack. India-first and low cost. No video hosting bill before revenue. |
| 2026-11-04 | Separate consent before health limitations go to the AI. Send minimum fields only. | Health data is sensitive. The AI provider sits outside India. |
| 2026-11-04 | Out of v1: payments, marketplace, academies, minors, phone OTP, Hindi, native apps, 3D, live, community. | Keep v1 focused. Get real-user evidence first. |
| 2026-11-04 | All project files live in `C:\Users\LENOVO\Desktop\Projects\fitSphere`. Moved there from `C:\Users\LENOVO\Projects` the same day. | The owner wants one folder for the whole project, on the Desktop. |
| 2026-11-04 | GitHub repo is private: `kritagyasuryavanshi/fitSphere`. | Default until the owner says otherwise. |
| 2026-11-04 | Git author is `Kritagya Suryavanshi <kritagya.suryarock@gmail.com>`. | The owner's real name and email. |

## Constraints
- No placeholder pages, dead buttons or fake data. Sample content carries a "Sample" label.
- Do not deploy, delete data, or force-push without the owner's approval.
- Do not store secrets in the repo. Use `.env` files, which git ignores.
- Demand evidence is zero. Treat pricing and usage assumptions as hypotheses.

## Lessons learned
- SEO plugins (2026-11-05): claude-seo is installed but disabled until launch (board M6-01 re-enables it). OpenSEO is enabled; it uses a paid hosted service (app.openseo.so) and needs sign-in on first use.
- The `skills` CLI needs Node 22.20+. Run it with `npx -y -p node@22 -p skills skills ...` until Node is upgraded.
- gstack tools that need Bun fail on this PC until Bun is installed. Codex CLI is not installed, so outside reviews fall back to a Claude subagent.
