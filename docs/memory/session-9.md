---
name: session-9
type: session
description: 2026-11-12: M1-01 review fixes, M1-02 sign-in built and reviewed, GitHub plugin and Codex back
updated: 2026-11-12
date: 2026-11-12
pc: lenovo
---

## Done
- `/code-review` at high on the [[M1-01]] diff found 10 items. Eight are fixed in commit `3812c53` on PR #4, and CI is green ([[db]]).
- `revoke_role` locks the admin rows first. A two-session race now leaves one admin, not zero.
- `audit_log` uses `clock_timestamp`, and a role update logs the revoke before the grant. pgTAP has 35 identity checks.
- The GitHub plugin token is set again on [[env-lenovo-pc]] as a user variable, 93 characters ([[tooling]]).

- [[M1-02]] sign-in built: email link and Google, PR #5 stacked on #4. 22 e2e tests on phone and desktop.
- M1-02 got four reviews: `/code-review`, the planner, a security scan and Codex. Three found the same bug, below. All fixed in `6ac3d33`.
- Codex is the second reviewer again ([[tooling]]).

## Bugs and errors
- `enable_confirmations = false` made GoTrue confirm every user at once, so the profile-on-confirm trigger did nothing. It is now on, and e2e checks the account before and after the click ([[db]]).
- A password set by `signUp` before confirmation survived it. A trigger now drops it, and an e2e test proves the planted password fails.
- Next 16 with Cache Components needs request reads behind `<Suspense>`, and `await connection()` before code that reads the clock.
- The token was unset in the Claude Code shell. The first reset saved the command text, because the clipboard held the command.
- The auto-mode classifier blocks Claude from reading or writing the token. The owner runs those commands with `!`.

## Decisions
- An admin who uses a second account to change their own roles is accepted. Admins are trusted, and the audit log records every change.
- A profile created before the email link is clicked moves to [[M1-02]]. Done there.
- Passwords are not in the product, so a password set before confirmation is dropped.
- Release gate for sign-in: hosted "Confirm email" on, custom SMTP, Turnstile CAPTCHA, `NEXT_PUBLIC_SITE_URL`, exact redirect domains.

## Needs you
- Restart Claude Code and run `/mcp` to confirm GitHub connects.
- Rotate the GitHub token, because it appeared in the chat.
- Merge PRs #1 to #5, in order.
- Push the rulebook commit for Codex from a PC that can push to `suryavanshi-claude`.

## Next
- [[M1-03]] sign-up step 1: name, date of birth with the server-side 18+ check, sports.
