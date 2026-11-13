# fitSphere: Project Memory

This file holds only the current state. Everything else lives in the memory graph in `docs/memory/`.
Read `docs/memory/INDEX.md` next, then open only the notes the task needs.
How the graph works: `docs/memory/memory-system.md`. See the graph in the board's Memory tab: https://claude.ai/artifact/BPCG8ghatzZkV7v1haJ1z1

## Current state
- **Phase:** building. Plan and stack approved. Design system, local DB and CI done.
- **Current milestone:** M1 Foundation. S0 done except S0-06 (waits on owner accounts, O-02). M1-01 to M1-08 done.
- **Open PRs:** #1 (S0-05 CI), #2 (memory graph), #3 (S0-07 e2e), #4 (M1-01 identity), #5 (M1-02 sign-in), #6 (M1-03), #7 (M1-04), #8 (M1-05), #9 (M1-06), #10 (M1-07), #11 (M1-08). Each is stacked on the one before. Merge in that order. The owner merges them; Claude cannot merge in auto mode.
- **LENOVO PC:** Docker works. Local DB, pgTAP and Playwright run here.
- **Next step for the next session:** M1-09 (milestone check M1). M1-01 to M1-08 are done, on stacked PRs #4 to #11. Lesson: run e2e on a production build before pushing (`docs/memory/lesson-prod-build-e2e.md`).
- **Open owner decisions:** see `docs/memory/owner-decisions.md`.
- **Last session:** `docs/memory/session-9.md`.
