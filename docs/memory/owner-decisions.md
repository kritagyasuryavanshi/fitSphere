---
name: owner-decisions
type: area
description: Open items that wait on the owner
updated: 2026-11-19
---

- Merge PR #27 (M3-04) if it is still open: CI and both reviews are on the PR ([[session-12]]).
- Follow-up, invites: after signing in, a guest lands on their home screen, not back on the invite. A safe return-to path through the magic link and Google callbacks is needed ([[programs]]).
- Follow-up, builder: two tabs saving the same draft overwrite each other (last save wins). A version check needs a new `save_program_draft` signature ([[programs]]).
- Decide with M3-11: may a coach see an athlete's body metrics? Today only profile, sport answers and training basics are shared with the coach ([[programs]]).
- Sharing the date of birth with an enrolled athlete's coach follows the design ("onboarding data while enrolled"). Say if a coach should see age only.
- Merge PR #1 to #6, in order ([[ci]]).
- Before launch: a parental-consent step for under-18s, confirmed by a lawyer. There is no age limit now ([[decision-no-age-limit]]), so the app can hold a child's health data without it.
- Before real emails use `/auth/confirm`: add a "Continue" page that POSTs, to stop login CSRF. Until then it is test-only ([[route-guards]]).
- Follow-up for M3/M5: check per-sport answers against option lists stored as data in `categories`, before coaches or the AI read them ([[M1-04-review]]).
- Before launch: a protected owner account. Today any admin can remove another admin's role; the audit log records it ([[M1-06]] review). Default applied: accepted for M1.
- People with no role: refused for now (default applied). Revisit when a real suspend feature is built.
- Submit buttons wait for the page script (hydration), so a tap is never sent twice. Trade-off: without the script nobody can sign in. Reviewers suggested server-side idempotency instead; sign-in also retries once on a duplicate. Keep or change ([[lesson-prod-build-e2e]]).
- When the email sender starts: drop outbox rows older than about 7 days so no stale decision goes out (M1-07 review).
- Is there a minimum age for coaches? Nothing checks it now ([[decision-no-age-limit]]).
- Account deletion (M1-08, defaults applied): consent history is deleted with the account; the audit log keeps role events and an `account_deleted` event by id only; a sole admin cannot delete their own account (document a manual owner path). A lawyer should confirm the DPDP proof-of-consent position.
- Route map change: `/account` pages serve every signed-in person, not only athletes (M1-08 review).
- The mockup's "use my sport, level and goals in AI answers" switch is left out: it defaulted to on.
- Add the legal pages (`/legal/terms`, `/legal/privacy`); links already point there and return 404 until then.
- Approve the skills switch-off list from the /usage review (10 unused skills), or change it ([[tooling]]).
- Set `GITHUB_PERSONAL_ACCESS_TOKEN` for the github plugin, or switch it off ([[tooling]]).
- Switch off the unused plugins and remove the Neon connector ([[tooling]]).
- Untracked `AGENTS.md` and `.codex/hooks.json` appeared in the repo on 2026-11-12; keep or delete ([[session-8]]).
- Before M1-08: should consent history survive account deletion? Block admin self-delete? ([[M1-01]] review)
- Run the scoped git credential fix, then push `suryavanshi-claude` ([[lesson-gh-workflow-scope]]).
- Branch protection for `main`: needs GitHub Pro (paid) or a public repo. See [[ci]].
- [[O-02]]: Supabase, Vercel, Anthropic and Google OAuth accounts. Blocks [[S0-06]] and Google sign-in.
- [[O-09]]: answer Q-01–Q-15 or accept the defaults ([[architecture-docs]]).
- O-04 to O-08 on the board.
- Before M4: payment provider, fee %, refund and cancel terms, business and GST registration, coach agreement ([[marketplace]]).
- Nutrition for fat-loss users ([[decision-no-nutrition]]).
- Mobbin: only unofficial MCPs exist; needs a paid account. The owner must say "install mobbin-mcp".
