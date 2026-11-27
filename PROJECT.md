# fitSphere: Project Brief

## Vision
"One platform. Every sport. Every skill. Every goal."
FitSphere is a sports learning, training and coaching platform. It connects learning a skill, practising its drills, and getting feedback from a coach.
Full long-term vision: `docs/PRODUCT_BRIEF.md`. Approved v1 design: `docs/designs/fitsphere-v1.md`.

## v1 scope
- **Categories:** three equal paths: Boxing, general Strength & Conditioning (for any sport or everyday fitness), and Gym & Fitness (hypertrophy, strength, fat loss). No sport is the default. Categories are data, so more can be added. Cricket and other sports are planned and show only as "coming later" until they have real plans, content, tracking and coaching (`docs/memory/decision-multi-sport.md`).
- **Pillar 1, Video Learning Library:** public, coach-authored, reviewed lessons with YouTube embeds, search, filters, save and complete.
- **Pillar 2, AI Instructional Assistant:** grounded in published content, cites sources, labelled apart from coach-verified content, safe.
- **Pillar 3, Coach-Led Training:** coach programs, invite links, a combined Today dashboard, sport-specific logging, coach feedback, basic progress.
- **Coach Marketplace:** discover, compare, hire and pay coaches; payouts; verified reviews. Added to v1 on 2026-11-05.

## Target users
- Adult (18+) boxing beginners and early intermediates in Indian cities.
- Independent boxing and S&C coaches who run programs on WhatsApp today.

## Out of v1
Academies, minors, phone OTP, Hindi, native apps, 3D, live classes, community, paid video hosting, meal plans and calorie targets.

## Stack
Monorepo (npm workspaces + Turborepo): `apps/web` (Next.js App Router, TypeScript strict, PWA), `packages/core`, `packages/ui`, `packages/db`, `packages/config`.
Services: Vercel, Supabase (Mumbai: Postgres, RLS, Auth), Razorpay, Claude via the Anthropic API. AI retrieval uses Postgres full-text search in v1.
Details: `docs/architecture/architecture.md` and `docs/memory/stack.md`.

## Milestones
The build board is the source of truth: `docs/plans/board.json`, shown at https://claude.ai/artifact/BPCG8ghatzZkV7v1haJ1z1.
S0 Setup · M1 Foundation · M2 Library · M3 Training · M4 Marketplace · M5 AI guide · M6 Launch.
Each task carries its acceptance criteria. `npm run verify` and CI must pass before a task is done.

## Open questions
See "Open Questions" and "Reviewer Concerns" in `docs/designs/fitsphere-v1.md`.

## Links
- Repo: https://github.com/kritagyasuryavanshi/fitSphere
