# fitSphere: Project Brief

## Vision
"One platform. Every sport. Every skill. Every goal."
FitSphere is a sports learning, training and coaching platform. It connects learning a skill, practising its drills, and getting feedback from a coach.
Full long-term vision: `docs/PRODUCT_BRIEF.md`. Approved v1 design: `docs/designs/fitsphere-v1.md`.

## v1 scope
- **Sports:** Boxing (primary) and Strength & Conditioning (integrated support). The data model is multi-sport.
- **Pillar 1, Video Learning Library:** public, coach-authored, reviewed lessons with YouTube embeds, search, filters, save and complete.
- **Pillar 2, AI Instructional Assistant:** grounded in published content, cites sources, labelled apart from coach-verified content, safe.
- **Pillar 3, Coach-Led Training:** coach programs, invite links, a combined Today dashboard, sport-specific logging, coach feedback, basic progress.

## Target users
- Adult (18+) boxing beginners and early intermediates in Indian cities.
- Independent boxing and S&C coaches who run programs on WhatsApp today.

## Out of v1
Payments, subscriptions, marketplace and booking, credential verification, academies, minors, phone OTP, Hindi, native apps, 3D, live classes, community, paid video hosting.

## Stack
| Layer | Choice | Status |
|---|---|---|
| Frontend | Next.js (App Router, TypeScript), PWA | Approved |
| Hosting | Vercel | Approved |
| Database and auth | Supabase (Postgres, RLS, Auth, pgvector) | Approved |
| AI | Claude via Anthropic API, server-side; model chosen at build time | Approved |
| Embeddings | To decide in the engineering plan | Open |

## Milestones
Full Verify lines are in `docs/designs/fitsphere-v1.md`.

0. **M0: Scaffold.** Done.
   **Verify:** `git status -sb` shows `main...origin/main` with no changes.
1. **M1: Foundation.** Schema, RLS, auth, roles, 18+ onboarding, CI.
   **Verify:** typecheck, lint, tests and build pass; policy tests cover the six access rules in the design doc.
2. **M2: Video Learning Library.**
   **Verify:** the library end-to-end test passes; drafts return 404; samples never show "Coach-verified".
3. **M3: Coach-Led Training.**
   **Verify:** the coach-to-athlete end-to-end test passes; progress equals the logged data.
4. **M4: AI Instructional Assistant.**
   **Verify:** `npm run eval:ai` scores 100% on code-checked rules in 3 runs and at least 90% average judge score.
5. **M5: Launch readiness.**
   **Verify:** Lighthouse mobile at least 80 on key pages; no placeholder pages; `/qa` shows no high-severity bugs.

## Open questions
See "Open Questions" and "Reviewer Concerns" in `docs/designs/fitsphere-v1.md`.

## Links
- Repo: https://github.com/kritagyasuryavanshi/fitSphere
