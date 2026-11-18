# fitSphere: Project Memory

This file holds only the current state. Everything else lives in the memory graph in `docs/memory/`.
Read `docs/memory/INDEX.md` next, then open only the notes the task needs.
How the graph works: `docs/memory/memory-system.md`. See the graph in the board's Memory tab: https://claude.ai/artifact/BPCG8ghatzZkV7v1haJ1z1

## Current state
- **Phase:** building. Plan and stack approved. Design system, local DB and CI done.
- **Current milestone:** M3 Coach-Led Training. M2 is done (`docs/memory/M2-check.md`). S0-06 waits on owner accounts (O-02).
- **Open PRs:** #22 (M3-01 program schema), #23 (M3-05 schedule, stacked on #22). Branch `m3-03-invites` is pushed (invites database part, stacked on #23) with no PR yet. Merge in order after green CI with `gh pr merge --merge`.
- **LENOVO PC:** Docker works. Local DB, pgTAP and Playwright run here.
- **Next step for the next session:** follow the Next list in `docs/memory/session-11.md`. Run e2e on a production build before pushing; `E2E_PORT` picks a free port.
- **Open owner decisions:** see `docs/memory/owner-decisions.md`.
- **Last session:** `docs/memory/session-11.md`.
