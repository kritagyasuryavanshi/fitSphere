---
name: lesson-disk-full-turbo
type: lesson
description: The .turbo build cache grew to 24 GB and filled the LENOVO PC's C: drive; Docker, npm and the local database then failed
updated: 2026-11-21
---

On 2026-11-21 the C: drive on the LENOVO PC ([[env-lenovo-pc]]) reached 0 bytes free.
- `.turbo` in the repo root held 24 GB of old build outputs.
- Symptoms:
  - background runs were stopped for low memory;
  - npm failed with ENOSPC;
  - Docker's engine returned 500;
  - the local Supabase timed out on its connection pool.
- Fix: delete `.turbo` (git ignores it, and Turborepo rebuilds it). Run this in PowerShell at the PC:
  `Remove-Item -Recurse -Force C:\Users\LENOVO\Desktop\Projects\fitSphere\.turbo`
- Claude may not delete it unless `/permissions` allows `Bash(rm -rf /c/Users/LENOVO/Desktop/Projects/fitSphere/.turbo)`. `!` commands do not run over Remote Control.
- Check free space every few weeks. Turborepo has no cache size limit setting that I know of.

Seen in [[session-14]].
