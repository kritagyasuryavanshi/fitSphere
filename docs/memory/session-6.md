---
name: session-6
type: session
description: 2026-11-12: back on LENOVO, CI, memory graph, Updates tab, setup audit, Docker install
updated: 2026-11-12
date: 2026-11-12
pc: lenovo
---

## Done
- [[S0-05]] CI on GitHub Actions ([[ci]]). PR #1, first run green.
- Moved memory from `MEMORY.md` into this graph ([[memory-system]]). The board got Memory and Updates tabs ([[build-board]]). PR #2.
- Rewrote the stale `README.md` and `PROJECT.md`.
- Installed Bun (gstack works again), WSL 3.0.5 and Docker Desktop 4.99.0 ([[env-lenovo-pc]], [[tooling]]).
- The owner applied the project permission allow list.
- Wrote the routine for working across two PCs ([[multi-pc-workflow]]).

## Bugs and errors
- `npm run verify` failed: `node_modules` was stale after the pull. Fixed with `npm ci` ([[lesson-stale-node-modules]]).
- Push of the workflow file was rejected for a missing `workflow` scope. Fixed ([[lesson-gh-workflow-scope]]).
- `gh pr merge` is blocked by auto mode, even with an allow rule ([[lesson-auto-mode-merge]]). Open.
- Branch protection is not possible on GitHub Free for a private repo ([[ci]]).

## Decisions
- No Codex subscription. Reviews use a Claude subagent ([[tooling]]).
- Act without asking on small tasks; ask only when confused or the direction is unclear ([[owner-profile]]).

## Needs you
- Restart the LENOVO PC, then open Docker Desktop once and accept its terms.
- Merge PR #1, then PR #2.
- Decide on branch protection (GitHub Pro or a public repo).

## Next
- Post-restart Docker checks ([[env-lenovo-pc]]).
- [[S0-07]] Playwright harness, then [[M1-01]].
