---
name: env-lenovo-pc
type: environment
description: LENOVO PC, the Desktop path, Node 26, Docker 29
updated: 2026-11-12
---

- Repo: `C:\Users\LENOVO\Desktop\Projects\fitSphere`.
- Node 26.13, npm 11.20, git, WSL, `gh` logged in as `kritagyasuryavanshi` with the `workflow` scope.
- 2026-11-12: WSL 3.0.5 and Docker Desktop 4.99.0 installed by an elevated script (Windows features WSL and VirtualMachinePlatform, winget packages). The user is in `docker-users`. A restart was pending at the end of [[session-6]].
- [[session-7]]: post-restart checks pass. Docker server 29.9.3, `db:start` and `test:db` green, `.env.local` recreated. Playwright Chromium installed.
- Post-restart steps, for reference: open Docker Desktop once and accept its terms, then `docker version`, `npm run db:start`, `npm run test:db`, and recreate `apps/web/.env.local` from `npx supabase status` ([[db]]). If images fail with "exec format error", see [[lesson-docker-welcome]].
- 45 GB free on C:, 7.8 GB RAM, virtualization on. Analytics stays off in Supabase to save RAM.
- Bun 1.4.4 and Codex CLI 0.167.2 installed in [[session-6]] ([[tooling]]).
- Python available (board and mockup scripts).
- Checked in [[session-6]]. See [[lesson-stale-node-modules]], [[project-overview]].
