---
name: lesson-lenovo-local-storage
type: lesson
description: 2026-11-25, fixed 2026-11-27: link pins in packages/db/supabase/.temp (storage-version, postgres-version, storage-migration) stopped the local storage tables
updated: 2026-11-27
---

On the LENOVO PC, `npm run db:start` and `npm run db:reset` stop at `20261130000000_marketplace_profiles.sql` with `relation "storage.buckets" does not exist`. Code, build and unit tests are fine; CI and the WELCOME PC are not affected.

What is known:
- The storage container (`storage-api:v1.96.4`) logs only vector_store migrations. `storage.migrations` lists 81 rows, but no other storage table exists.
- It fails the same way after `supabase stop --no-backup` (fresh volumes), so an old backup is not the cause.
- `packages/db/supabase/.temp/storage-migration` holds `revoke-extra-lifecycle-postgres-grants`, written by `supabase link` on 2026-11-19. The container gets it as `DB_MIGRATIONS_FREEZE_AT`. Suspected cause, not proven.
- A test with that file renamed crashed the CLI (a bun crash report, exit 3) before it showed anything. The file is back as it was.
- Supabase CLI is 3.0.0 here; 3.4.0 exists.

**Fixed on 2026-11-27 ([[session-18]]).** Cause: the version pins that `supabase link` wrote into `packages/db/supabase/.temp`: `storage-version` (v1.96.4), `postgres-version` (17.12.0.000) and `storage-migration`. With them, `supabase start` set up storage from the pinned versions and created no storage tables. They now sit in `.temp.off` (ignored by git), and the link files are back in `.temp`. Then `db:start`, 1133 pgTAP tests and e2e run here. A new `supabase link` writes the pins again: move those three files aside after it.

Ruled out first, on 2026-11-27 ([[session-18]]), each with Docker Desktop freshly started and `supabase stop --no-backup` first:
- The freeze file: renamed, the same error. It is back in place.
- The CLI version: `npx supabase@3.4.0 start` gives the same error.

Old list, steps 2 and 3 now done:
1. Restart Docker Desktop, then `npx supabase stop --no-backup` in `packages\db`.
2. Rename `.temp/storage-migration` again and run `npm run db:start`. If storage now has its tables, the freeze file is the cause; check what the WELCOME PC's file holds.
3. Else compare the storage image tag and CLI version with the WELCOME PC, or update the CLI on a branch.

Next: compare `docker images` storage-api tags and Docker Desktop settings (WSL 2 engine, file sharing) with the WELCOME PC. Until then run pgTAP and e2e on the WELCOME PC or in CI.

Related: [[env-lenovo-pc]], [[lesson-disk-full-turbo]]. Hub: [[db]].
