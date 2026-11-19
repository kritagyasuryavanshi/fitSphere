---
name: lesson-supabase-remote-flag
type: lesson
description: 2026-11-19: Supabase CLI v3 targets the local stack by default; production commands need --remote
updated: 2026-11-19
---

Supabase CLI v3 runs `db push` and `migration list` against the local Docker stack unless `--remote` is given. The first line of output names the target: `Target: local stack (127.0.0.1:54322)` or `Target: project fitSphere (mxrwjhdqglozdxsgtjgw)`.

In [[session-13]] the first production push ran against the local stack and reported "Local database is up to date". Production stayed empty until the push ran with `--remote`.

How to apply:
- Production commands run from `packages\db` (the link lives there) and always carry `--remote`: `npx.cmd supabase db push --remote --dry-run`, then `npx.cmd supabase db push --remote`.
- Read the `Target:` line before trusting any result.
- Check afterwards with `npx supabase migration list --remote`: every local version must have the same remote version.
- `.claude/settings.json` denies `npx supabase db push*` for Claude, so the owner runs the push. On Windows PowerShell use `npx.cmd`, because `npx.ps1` is blocked by the execution policy.

Hub: [[db]].
