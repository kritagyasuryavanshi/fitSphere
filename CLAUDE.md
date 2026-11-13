# fitSphere

## Start of every session
1. `git pull`, then `npm ci` if `package-lock.json` changed.
2. Read `MEMORY.md` for the current state.
3. Read `docs/memory/INDEX.md`, then open the memory notes the task needs. Search them with `grep -rl <word> docs/memory`.
4. Read `PROJECT.md` and `TASKS.md` when scope or owner items matter.

## End of every session (do not skip)
Follow the routine in `docs/memory/memory-system.md`:
1. Add a `docs/memory/session-N.md` note that links to every note the session touched.
2. Add or update notes for new decisions, lessons and facts.
3. Update the current state in `MEMORY.md` and the owner items in `TASKS.md`.
4. Run `python docs/plans/build_board.py`. It fails on a broken link or an orphan note.
5. Commit, push, and republish the board artifact.

## Folder rule
All project files live in this repo. The owner works from more than one PC, so the path varies: `C:\Users\LENOVO\Desktop\Projects\fitSphere` and `C:\Users\WELCOME\fitSphere`.
Do not write project files outside the repo.
Project memory lives in `MEMORY.md` here, not only in Claude's auto-memory.

## File map
| File | Purpose |
|---|---|
| `PROJECT.md` | Vision, scope, stack, milestones, open questions. |
| `MEMORY.md` | Decisions with reasons, constraints, current state. |
| `TASKS.md` | Now, next, and done task lists. |
| `docs/plans/` | Detailed plans per milestone. |
| `.claude/settings.json` | Commands that run without a permission prompt. |

## Stack
Next.js + Vercel + Supabase + Claude API. See `PROJECT.md` and `docs/designs/fitsphere-v1.md`.

## Verification
Each milestone in `PROJECT.md` has its own Verify line.
Run `npm run verify` (typecheck, lint, tests, build across all workspaces) before marking a task done.
For database changes, with Docker running: `npm run db:start`, `npm run db:reset`, `npm run test:db`, then `npm run db:types`.

## Allowed without asking
Routine git add, commit, and push to `origin main`.
Never deploy, delete data, or force-push without approval.
