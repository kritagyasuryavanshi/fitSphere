# fitSphere

## Start of every session
1. Read `MEMORY.md` for decisions and the current state.
2. Read `PROJECT.md` for scope, stack, and milestones.
3. Read `TASKS.md` for what to do now.

## End of every session
- Update `MEMORY.md` with new decisions and the current state.
- Update `TASKS.md` with what is done and what is next.

## Folder rule
All project files live in this folder: `C:\Users\LENOVO\Desktop\Projects\fitSphere`.
Do not write project files anywhere else.
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
Add the test, lint, and build commands here once the stack is chosen.

## Allowed without asking
Routine git add, commit, and push to `origin main`.
Never deploy, delete data, or force-push without approval.
