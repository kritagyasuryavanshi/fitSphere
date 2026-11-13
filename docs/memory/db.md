---
name: db
type: area
description: packages/db, local Supabase commands, keys and settings
updated: 2026-11-12
---

Built in [[S0-04]] ([[session-5]]). Local Supabase needs Docker, not a cloud account ([[decision-local-supabase]]).

- `packages/db` holds the Supabase project, migrations, pgTAP tests, generated types and `createDbClient`.
- Root commands: `db:start`, `db:stop`, `db:reset`, `test:db`, `db:types`.
- Studio: http://127.0.0.1:54323.
- `apps/web/.env.local` holds the local keys and is git-ignored. Recreate it from `npx supabase status` in `packages/db`.
- Analytics is off in `supabase/config.toml`. Nothing uses it, it took 559 MB, and its log shipper restart-looped.
- Docker exists only on [[env-welcome-pc]]. [[ci]] runs the DB tests on every PR.
