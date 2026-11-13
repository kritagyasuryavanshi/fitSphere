---
name: multi-pc-workflow
type: constraint
description: How to work on fitSphere from two PCs without losing progress
updated: 2026-11-12
---
GitHub is the only shared state. Claude's chat history stays on each PC; the repo carries everything else ([[memory-system]]).

Start on any PC:
0. Open Docker Desktop (for DB work). Open a terminal in the project folder (Explorer: right-click the folder, Open in Terminal), run `claude`, and type `resume`. End with `wrap up`. Same for every project.
1. Open Claude in the fitSphere folder. The SessionStart hook fetches and shows if this PC is behind.
2. `git pull`, then `npm ci` if `package-lock.json` changed ([[lesson-stale-node-modules]]).
3. Read `MEMORY.md` and the latest session note. Check the board's Updates tab.

Before leaving a PC:
1. Write the session note, rebuild the board, commit and push. Unfinished work goes on its branch as a `WIP:` commit, pushed. Never leave work only on one PC.
2. Note PC-specific facts in that PC's environment note: [[env-lenovo-pc]], [[env-welcome-pc]].

Rules:
- Work on one PC at a time. Do not edit the same branch on both PCs.
- One branch per task. Merge to `main` only on green CI ([[ci]]).
- Secrets never sync through git. `apps/web/.env.local` is made per PC from `npx supabase status` ([[db]]). Cloud keys later live in a password manager.
- CI uses Node 22. Both PCs have Node 22 or later; `engines` requires 22 or later ([[stack]]).
- Global Claude config syncs through the `suryavanshi-claude` repo and `sync.sh` on session start ([[tooling]]).

Hub: [[project-overview]].
