---
name: M1-check
type: area
description: 2026-11-13: M1 milestone check (M1-09): evidence for each Verify item, and which items wait for M2 and M3
updated: 2026-11-13
---

M1 is done on stacked PRs #4 to #11 ([[M1-09]], [[session-9]]). CI is green on all of them (verify, db, e2e).

Evidence per M1 Verify item (docs/designs/fitsphere-v1.md):
- typecheck, lint, tests, build: `npm run verify` green locally and in CI; 80 e2e pass on a production build.
- An athlete cannot read another athlete's data: pgTAP `identity_test`, `welcome_steps_test`, `account_test`.
- Only an admin grants coach or reviewer: pgTAP `admin_people_test`, `identity_test`; e2e `admin-people`.
- Sign-up and onboarding end to end, date of birth kept, AI consent as a separate yes/no: e2e `welcome-steps`, `welcome`.
- Codex reviewed every auth and RLS PR; each finding was fixed or rejected with evidence ([[route-guards]], [[M1-04-review]]).

Waiting on later tables (already in their task criteria): draft content and publish rules in M2-01; coach access to athletes in M3-04.
Vercel preview deploys wait on [[O-02]].
