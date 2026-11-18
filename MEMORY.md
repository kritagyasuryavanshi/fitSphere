# fitSphere: Project Memory

This file holds only the current state. Everything else lives in the memory graph in `docs/memory/`.
Read `docs/memory/INDEX.md` next, then open only the notes the task needs.
How the graph works: `docs/memory/memory-system.md`. See the graph in the board's Memory tab: https://claude.ai/artifact/BPCG8ghatzZkV7v1haJ1z1

## Current state
- **Phase:** building. Plan and stack approved. Design system, local DB and CI done.
- **Current milestone:** M3 Coach-Led Training. Done: M3-01 schema, M3-02 builder, M3-03 invites, M3-04 enrollments and the coach access rule, M3-05 schedule, M3-06 Today. M2 is done (`docs/memory/M2-check.md`). S0-06 waits on owner accounts (O-02).
- **Open PRs:** #28 (M3-06) if not yet merged; merge after green CI with `gh pr merge --merge`.
- **Both PCs:** Docker works; local DB, pgTAP and Playwright run. WELCOME PC details: `docs/memory/env-welcome-pc.md`.
- **Next step for the next session:** M3-07 boxing session player or M3-08 set logger (both ready; either adds Start on Today), then on through the M3 list on the board. Hub for programs work: `docs/memory/programs.md`. Run e2e on a production build before pushing; `E2E_PORT` picks a free port.
- **Open owner decisions:** see `docs/memory/owner-decisions.md`.
- **Last session:** `docs/memory/session-12.md`.
