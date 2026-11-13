---
name: session-9
type: session
description: 2026-11-12: /code-review high on M1-01, review fixes, GitHub plugin token reset on LENOVO
updated: 2026-11-12
date: 2026-11-12
pc: lenovo
---

## Done
- `/code-review` at high on the [[M1-01]] diff found 10 items. Eight are fixed in commit `3812c53` on PR #4, and CI is green ([[db]]).
- `revoke_role` locks the admin rows first. A two-session race now leaves one admin, not zero.
- `audit_log` uses `clock_timestamp`, and a role update logs the revoke before the grant. pgTAP has 35 identity checks.
- The GitHub plugin token is set again on [[env-lenovo-pc]] as a user variable, 93 characters ([[tooling]]).

## Bugs and errors
- The token was unset in the Claude Code shell. The first reset saved the command text, because the clipboard held the command.
- The auto-mode classifier blocks Claude from reading or writing the token. The owner runs those commands with `!`.

## Decisions
- An admin who uses a second account to change their own roles is accepted. Admins are trusted, and the audit log records every change.
- A profile created before the email link is clicked moves to [[M1-02]].

## Needs you
- Restart Claude Code and run `/mcp` to confirm GitHub connects.
- Rotate the GitHub token, because it appeared in the chat.
- Merge PRs #1, #2, #3 and #4, in order.

## Next
- [[M1-02]] sign-in. Handle the review item on profiles for unconfirmed sign-ups.
