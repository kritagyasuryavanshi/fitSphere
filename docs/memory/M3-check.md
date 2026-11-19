---
name: M3-check
type: area
description: 2026-11-19: milestone M3 Coach-Led Training is done; how it was verified
updated: 2026-11-19
---

M3 (Coach-Led Training) is done: all 16 tasks, PRs #22 to #39. Hub: [[programs]].

How it was verified ([[M3-15]], PR #39):
- `apps/web/e2e/m3-check.spec.ts` follows the M3 Verify line in `docs/designs/fitsphere-v1.md` in one test: a program with a boxing and an S&C session, join by link, Today shows both, rounds and sets logged, the coach sees the logs and sends feedback, the athlete sees it, Progress shows 2 of 2 at 100% with the record and the rating. The builder screens are `program-builder.spec.ts`; the gym path is `set-logger.spec.ts` and `progress.spec.ts`.
- QA of the live site (public pages, phone and desktop, read-only, Playwright and axe): 2 high (menus linked to 6 pages that do not exist; no privacy or terms pages) and 2 medium (`/learn` 404, one contrast failure), all fixed. `links.spec.ts` now fails on any dead internal link.
- Every M3 PR had Codex and `/code-review high`; access changes also had `/security-review`. RLS reviews by Codex: done per PR in [[session-13]].

Open after M3: the privacy policy and terms need a legal review (O-07); email sending waits on Resend ([[env-production]]).
