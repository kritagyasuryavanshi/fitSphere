---
name: stack
type: area
description: Monorepo layout, frameworks and services
updated: 2026-11-12
---

Locked in [[decision-stack-locked]].

- npm workspaces + Turborepo.
- `apps/web`: Next.js 16 App Router, TypeScript strict. Fonts via `next/font/google` (Anton, Inter) in the root layout. Tailwind 4 via `@import "tailwindcss"` with `@theme` tokens.
- `packages/core`: pure rules and the metric-type registry.
- `packages/ui`: the Fight Camp design system. See [[design-system]].
- `packages/db`: Supabase migrations, types, pgTAP. See [[db]].
- `packages/config`: shared config.
- Services: Supabase (Mumbai), Razorpay, Claude API, Vercel.
- Extensibility: categories are data, metric types are a registry, features are modules, a feature flags table. Details: `docs/architecture/architecture.md` §5.
- Checks: `npm run verify` runs typecheck, lint, test and build. gstack `/verify` needs Bun ([[lesson-bun-gstack]]). CI runs the same checks: [[ci]].
- Built by [[S0-02]]. Earlier stack choice: [[decision-pwa-stack]].
