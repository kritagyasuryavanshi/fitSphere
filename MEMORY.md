# fitSphere: Project Memory

This file holds only the current state. Everything else lives in the memory graph in `docs/memory/`.
Read `docs/memory/INDEX.md` next, then open only the notes the task needs.
How the graph works: `docs/memory/memory-system.md`. See the graph in the board's Memory tab: https://claude.ai/artifact/BPCG8ghatzZkV7v1haJ1z1

## Current state
- **Phase:** building. Plan and stack approved. Design system, local DB and CI done.
- **Current milestone:** S0 Setup. S0-01 to S0-05 and S0-07 are done. S0-06 waits on owner accounts (O-02).
- **Open PRs:** #1 (S0-05 CI), #2 (memory graph), #3 (S0-07 e2e, stacked on #2). Merge in that order. The owner merges them; Claude cannot merge in auto mode.
- **LENOVO PC:** Docker works. Local DB, pgTAP and Playwright run here.
- **Next step for the next session:** M1-01 (identity schema with RLS). Unblocked. High risk, so it gets a planner and security review.
- **Open owner decisions:** see `docs/memory/owner-decisions.md`.
- **Last session:** `docs/memory/session-7.md`.
