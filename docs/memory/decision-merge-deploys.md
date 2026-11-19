---
name: decision-merge-deploys
type: decision
description: 2026-11-19: a PR that passes CI and review may merge without asking, which deploys production
updated: 2026-11-19
---

Vercel deploys production on every merge to `main` ([[env-production]]). On 2026-11-19 the owner approved: a PR that has a green CI run on its head commit and has had its reviews (Codex and `/code-review`, plus `/security-review` and the `planner` for high-risk work) may merge without asking, and that merge is the production deploy.

**Why:** there are no real users yet (only the owner and testers), and a bad deploy rolls back in one click: Vercel → Deployments → Promote on an earlier build.

**How to apply:**
- Still ask first for: production database changes (`supabase db push --remote`, any SQL write), secret changes, and anything outside a reviewed PR.
- Revisit this decision before the release gate in `TASKS.md` opens the site to real users.
- After a merge, check the live site at https://fit-sphere-xi.vercel.app.

Hub: [[project-overview]].
