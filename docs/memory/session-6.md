---
name: session-6
type: session
description: 2026-11-12: back on LENOVO, CI, memory graph, permissions audit
updated: 2026-11-12
---

- [[S0-05]] done ([[ci]]), PR #1, first run green.
- Lessons: [[lesson-gh-workflow-scope]], [[lesson-auto-mode-merge]], [[lesson-stale-node-modules]].
- Moved memory from `MEMORY.md` into this graph ([[memory-system]]). The board got a Memory tab ([[build-board]]).
- Checked [[env-lenovo-pc]]. Audited permissions and the folder ([[tooling]]). Installed Bun, the Codex CLI (unused: no subscription), WSL and Docker Desktop. The owner applied the permission allow list.
- Folder audit: no secrets tracked, `.env` files ignored, no production advisories, 7 moderate dev-only advisories (known). `README.md` and `PROJECT.md` were stale (no Gym, marketplace listed as out of v1, old milestones) and were rewritten. `docs/mockups` is 21 MB, 6.6 MB of it before/after screenshots; left as is.
- Owner direction: act without asking on small tasks; ask only when confused or the direction is unclear ([[owner-profile]]).
