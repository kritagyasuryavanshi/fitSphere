# fitSphere: Project Memory

This file holds decisions, their reasons, and the current state.
Every session reads it first and updates it before it ends.
Keep newest entries at the top of each section.

## Current state
- **Phase:** v1 design approved. Full-site clickable design done (47 linked screens). Engineering plan next. No app code exists yet.
- **Current milestone:** M1 Foundation, not started.
- **Next step for the next session:**
  1. Get the owner's feedback on the full-site design (47 linked screens on the canvas page "Fight Camp · full site").
  2. Settle the stack question: the owner asked for a "Python engineering plan", but the approved stack is Next.js + Supabase. Option on the table: Next.js web app plus a Python (FastAPI) service for the AI assistant. Ask once, then decide.
  3. Write the engineering plan for M1 to M5 in `docs/plans/`. Cover schema, RLS rules, test setup, and the four minor reviewer concerns in the design doc. After approval, build M1 hands-off.
- **Open owner decisions:** Mobbin install (only unofficial community MCPs exist; needs a paid Mobbin account and a session token; owner must say "install mobbin-mcp").
- **Owner's parallel task:** meet one boxing coach and one S&C coach (the assignment in the design doc).

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
- The `skills` CLI needs Node 22.20+. Run it with `npx -y -p node@22 -p skills skills ...` until Node is upgraded.
- gstack tools that need Bun fail on this PC until Bun is installed. Codex CLI is not installed, so outside reviews fall back to a Claude subagent.
