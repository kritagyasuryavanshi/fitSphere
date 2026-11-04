# fitSphere: Project Memory

This file holds decisions, their reasons, and the current state.
Every session reads it first and updates it before it ends.
Keep newest entries at the top of each section.

## Current state
- **Phase:** v1 design approved on 2026-11-04. Engineering plan next. No app code exists yet.
- **Current milestone:** M1 Foundation, not started.
- **Next step for the next session:** Write the engineering plan for M1 to M5 in `docs/plans/` with the owner. It covers schema, RLS rules, test setup, and the four minor reviewer concerns in the design doc. After the owner approves it, build M1 hands-off.
- **Owner's parallel task:** meet one boxing coach and one S&C coach (the assignment in the design doc).

## Last session (2026-11-04)
- Created the repo, the docs scaffold, and the private GitHub remote.
- Saved the owner's full brief to `docs/PRODUCT_BRIEF.md`.
- Ran /office-hours in startup mode. Approved design: `docs/designs/fitsphere-v1.md`. Cross-session copy: `~/.gstack/projects/kritagyasuryavanshi-fitSphere/`.
- One independent review round found 6 blocking issues, all fixed. 4 minor concerns stay open for the plan.
- Environment: `gh` CLI is installed and logged in as `kritagyasuryavanshi`. Bun and the Codex CLI are not installed. gstack was upgraded to v1.95.5.0, but its setup step failed for lack of Bun.
- The owner's preference: answer with a decision and move on. Avoid long question chains. The owner skipped several multi-question prompts.

## Decisions
| Date | Decision | Why |
|---|---|---|
| 2026-11-04 | v1 = three pillars: Video Learning Library, AI Instructional Assistant, Coach-Led Training. | Owner wants all three complete from day one and accepts a longer timeline. |
| 2026-11-04 | Launch sports: Boxing primary, S&C integrated support. Data model stays multi-sport. | Owner's choice. Both suit adults. S&C must not become a generic gym app. |
| 2026-11-04 | Coach-led content: coaches author, a reviewer publishes, nobody approves their own item. | Content quality and cold start are the main risks. Coaches bring content and athletes. |
| 2026-11-04 | AI answers cite published, non-sample content. With no match, AI explains concepts only and never prescribes. | Brief requires AI grounded in approved content and kept apart from coach-verified content. |
| 2026-11-04 | Adults only (18+) in v1. | India's DPDP Act needs verifiable parental consent for minors. Deferred to the academy phase. |
| 2026-11-04 | Mobile-first PWA on Next.js + Vercel + Supabase. YouTube embeds for video. | House default stack. India-first and low cost. No video hosting bill before revenue. |
| 2026-11-04 | Separate consent before health limitations go to the AI. Send minimum fields only. | Health data is sensitive. The AI provider sits outside India. |
| 2026-11-04 | Out of v1: payments, marketplace, academies, minors, phone OTP, Hindi, native apps, 3D, live, community. | Keep v1 focused. Get real-user evidence first. |
| 2026-11-04 | Moved the project folder to the Desktop. All project files live in `C:\Users\LENOVO\Projects\fitSphere`. | The owner wants one folder for the whole project. |
| 2026-11-04 | GitHub repo is private: `kritagyasuryavanshi/fitSphere`. | Default until the owner says otherwise. |
| 2026-11-04 | Git author is `Kritagya Suryavanshi <kritagya.suryarock@gmail.com>`. | The owner's real name and email. |

## Constraints
- No placeholder pages, dead buttons or fake data. Sample content carries a "Sample" label.
- Do not deploy, delete data, or force-push without the owner's approval.
- Do not store secrets in the repo. Use `.env` files, which git ignores.
- Demand evidence is zero. Treat pricing and usage assumptions as hypotheses.

## Lessons learned
- gstack tools that need Bun fail on this PC until Bun is installed. Codex CLI is not installed, so outside reviews fall back to a Claude subagent.
