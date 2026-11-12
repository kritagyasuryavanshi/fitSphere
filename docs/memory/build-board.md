---
name: build-board
type: area
description: board.json, the renderer, the artifact, and the working loop
updated: 2026-11-12
---

- `docs/plans/board.json` is the source of truth for tasks. `python docs/plans/build_board.py` validates it, checks the memory graph, and renders `board.html`.
- Published at https://claude.ai/artifact/BPCG8ghatzZkV7v1haJ1z1. Republish after every task.
- The board has two tabs: Tasks, and Memory, which draws [[memory-system]].
- Working loop: one task in progress at a time. Tests first. `npm run verify` plus the task's end-to-end test. Mark done with date and commit. Re-render and republish.
- Codex review at the end of each milestone for auth, RLS, payments and migrations.
- Engineering plan: `docs/plans/engineering-plan.md`. Created in [[session-3d]].
- Build inside the repo, not a temp folder ([[decision-build-in-repo]]).
