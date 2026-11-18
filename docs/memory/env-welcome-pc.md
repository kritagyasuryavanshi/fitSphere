---
name: env-welcome-pc
type: environment
description: WELCOME PC, Node 22, Docker 29 on D: (auto-starts), Playwright Chromium, local Supabase works
updated: 2026-11-19
---

- Repo: `C:\Users\WELCOME\fitSphere`.
- Node 22.19, npm 11.6, Docker 29, `gh` at `C:\Program Files\GitHub CLI\gh.exe`, logged in as `kritagyasuryavanshi`. Bun and Codex CLI are not installed here, so reviews use `/code-review` and `/security-review` ([[tooling]]).
- Docker Desktop is a per-user install at `C:\Users\WELCOME\AppData\Local\Programs\DockerDesktop` (not Program Files). Since [[session-12]] it starts at sign-in: `AutoStart` is true in `%APPDATA%\Docker\settings-store.json` and a `Docker Desktop` entry is in the HKCU Run key. Supabase does not start itself: run `npm run db:start` (it may say "container is not ready: starting" right after Docker starts; wait for the DB container to be healthy and run it again).
- Playwright Chromium is installed (since [[session-12]]).
- Sleep and hibernate are off on AC power, and Windows Update was paused to 2026-11-25, so the PC can run Claude unattended through Remote Control ([[multi-pc-workflow]]).
- 8 GB RAM and little space on C: (about 9 GB free). See [[lesson-docker-welcome]].
- Windows PowerShell 5.1 reads and writes UTF-8 files as the ANSI code page: see [[lesson-windows-powershell-utf8]].
- Session transcripts stay on each PC; the repo carries the context.
- Set up in [[session-5]]. See [[db]], [[project-overview]].
