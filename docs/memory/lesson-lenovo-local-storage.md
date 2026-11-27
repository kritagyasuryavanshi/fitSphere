---
name: lesson-lenovo-local-storage
type: lesson
description: 2026-11-25: on the LENOVO PC the local Supabase cannot start; storage never creates its tables, so migration 20261130000000 fails
updated: 2026-11-27
---

On the LENOVO PC, `npm run db:start` and `npm run db:reset` stop at `20261130000000_marketplace_profiles.sql` with `relation "storage.buckets" does not exist`. Code, build and unit tests are fine; CI and the WELCOME PC are not affected.

What is known:
- The storage container (`storage-api:v1.96.4`) logs only vector_store migrations. `storage.migrations` lists 81 rows, but no other storage table exists.
- It fails the same way after `supabase stop --no-backup` (fresh volumes), so an old backup is not the cause.
- `packages/db/supabase/.temp/storage-migration` holds `revoke-extra-lifecycle-postgres-grants`, written by `supabase link` on 2026-11-19. The container gets it as `DB_MIGRATIONS_FREEZE_AT`. Suspected cause, not proven.
- A test with that file renamed crashed the CLI (a bun crash report, exit 3) before it showed anything. The file is back as it was.
- Supabase CLI is 3.0.0 here; 3.4.0 exists.

Ruled out on 2026-11-27 ([[session-18]]), each with Docker Desktop freshly started and `supabase stop --no-backup` first:
- The freeze file: renamed, the same error. It is back in place.
- The CLI version: `npx supabase@3.4.0 start` gives the same error.

Old list, steps 2 and 3 now done:
1. Restart Docker Desktop, then `npx supabase stop --no-backup` in `packages\db`.
2. Rename `.temp/storage-migration` again and run `npm run db:start`. If storage now has its tables, the freeze file is the cause; check what the WELCOME PC's file holds.
3. Else compare the storage image tag and CLI version with the WELCOME PC, or update the CLI on a branch.

Next: compare `docker images` storage-api tags and Docker Desktop settings (WSL 2 engine, file sharing) with the WELCOME PC. Until then run pgTAP and e2e on the WELCOME PC or in CI.

Related: [[env-lenovo-pc]], [[lesson-disk-full-turbo]]. Hub: [[db]].
