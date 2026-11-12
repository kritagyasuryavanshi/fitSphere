---
name: memory-system
type: area
description: How the project memory graph works and the end-of-session routine
updated: 2026-11-12
---

Project memory is a graph of small notes in `docs/memory/`. Each note holds one topic. Notes link with `[[slug]]`. A link can also name a board task, such as `[[S0-05]]`.

Note types:
- **area:** a hub for one part of the project. Every other note links to at least one area.
- **decision:** a choice with its date and reason.
- **constraint:** a rule that holds for the whole project.
- **lesson:** something learned the hard way.
- **environment:** facts about one PC.
- **session:** what one session did, with links to the notes it changed.
- **bug:** one product bug, open or fixed.

Frontmatter fields: `name` (same as the file name), `type`, `description` (one line), `updated` (date).

`MEMORY.md` holds only the current state and points here. `INDEX.md` lists every note and is generated.

The board's Memory tab draws this graph: https://claude.ai/artifact/BPCG8ghatzZkV7v1haJ1z1. See [[build-board]].

End of every session:
1. Add a `session-N` note that links to every note the session touched. Frontmatter adds `date` (YYYY-MM-DD) and `pc` (`lenovo` or `welcome`). Body sections, in this order, empty ones left out: `## Done`, `## Bugs and errors`, `## Decisions`, `## Needs you`, `## Next`. The board's Updates tab shows these as the daily log, and "Waiting on you" comes from [[owner-decisions]].
   - A product bug that stays open past the session gets its own `bug-*` note with `status: open`, then `status: fixed` and the fix. Example: [[bug-button-52px]].
2. Update or add notes for new decisions, lessons and facts. Update `updated` on each.
3. Update the current state in `MEMORY.md`.
4. Run `python docs/plans/build_board.py`. It fails on a broken link or an orphan note.
5. Commit, push and republish the board.

Start of a session: read `MEMORY.md`, then `INDEX.md`, then open only the notes the task needs. Search with `grep -rl <word> docs/memory`.

Started in [[session-6]]. Hub: [[project-overview]].
