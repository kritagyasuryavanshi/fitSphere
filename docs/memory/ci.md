---
name: ci
type: area
description: GitHub Actions workflow, its jobs, and the merge rule
updated: 2026-11-12
---

Built in [[S0-05]] ([[session-6]]), PR #1.

- `.github/workflows/ci.yml` runs on every pull request and every push to `main`.
- Job `verify`: `npm ci`, then `npm run verify`.
- Job `db`: `npm run db:start`, `npm run test:db`, then regenerates types and fails if `database.types.ts` changed.
- Job `e2e` ([[S0-07]], [[session-7]], PR #3): starts Supabase, writes `apps/web/.env.local` from `supabase status -o env`, builds the web app, runs Playwright. Uploads `test-results/` on failure.
- The web build needs no secrets in CI.
- Branch protection is not possible on GitHub Free for a private repo (API 403). Until the owner decides ([[owner-decisions]]), merge only on a green run.
- Pushing workflow files: [[lesson-gh-workflow-scope]]. Merging: [[lesson-auto-mode-merge]].
