---
name: db
type: area
description: packages/db, local Supabase commands, keys and settings
updated: 2026-11-19
---

Built in [[S0-04]] ([[session-5]]). Local Supabase needs Docker, not a cloud account ([[decision-local-supabase]]).

- `packages/db` holds the Supabase project, migrations, pgTAP tests, generated types and `createDbClient`.
- Root commands: `db:start`, `db:stop`, `db:reset`, `test:db`, `db:types`.
- Studio: http://127.0.0.1:54323.
- `apps/web/.env.local` holds the local keys and is git-ignored. Recreate it from `npx supabase status` in `packages/db`.
- Analytics is off in `supabase/config.toml`. Nothing uses it, it took 559 MB, and its log shipper restart-looped.
- `supabase/seed.sql` ([[S0-07]]) adds five test users: athlete, coach1, coach2, reviewer, admin `@test.fitsphere`, password `password123`. Extra roles are rows in `user_roles` ([[M1-01]]). `db:start` and `db:reset` apply it.
- Docker runs on [[env-welcome-pc]] and [[env-lenovo-pc]]. [[ci]] runs the DB tests on every PR.
- Identity schema ([[M1-01]], [[session-8]]): `profiles`, `user_roles`, `consents` (append-only, newest row wins), `audit_log`. Roles change only through admin-only `grant_role` / `revoke_role`; nobody changes their own. A trigger audits every role change. `date_of_birth` is not client-writable: M1-03 must add a security definer function for the 18+ write. The first production admin needs a manual SQL insert.
- Programs, invites and enrollments ([[M3-01]], [[M3-03]], [[M3-04]]): see [[programs]]. Coach reads of athlete rows go only through `coach_can_read`. Migrations from [[session-12]]: `20261114100000_invites.sql`, `20261119000000_enrollment_access.sql`. `export_my_data` now lists programs joined.
- A function replaced in a later migration (`create or replace`) must copy the whole current body: `join_program` lives in the M3-04 migration, `export_my_data` in the invites migration.
