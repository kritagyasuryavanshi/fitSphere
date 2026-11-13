# fitSphere: Project Memory

This file holds only the current state. Everything else lives in the memory graph in `docs/memory/`.
Read `docs/memory/INDEX.md` next, then open only the notes the task needs.
How the graph works: `docs/memory/memory-system.md`. See the graph in the board's Memory tab: https://claude.ai/artifact/BPCG8ghatzZkV7v1haJ1z1

## Current state
- **Phase:** building. Plan and stack approved. Design system, local DB and CI done.
- **Current milestone:** M2 Library. M2-01 to M2-05 are built. S0-06 waits on owner accounts (O-02).
- **Open PRs:** #16 (M2-05) until CI passes. Claude merges each PR with `gh pr merge --merge` after green CI.
- **LENOVO PC:** Docker works. Local DB, pgTAP and Playwright run here.
- **Next step for the next session:** M2-06 (save and complete), then M2-08, M2-09, M2-07, M2-10, M2-11. Run e2e on a production build before pushing; `E2E_PORT` picks a free port.
- **Open owner decisions:** see `docs/memory/owner-decisions.md`.
- **Last session:** `docs/memory/session-10.md`.
