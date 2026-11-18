---
name: session-11
type: session
description: 2026-11-14: M3 started: program schema, schedule maths and invite links built; PRs #22 and #23 open
updated: 2026-11-14
date: 2026-11-14
pc: lenovo
---

Follows [[session-10]]. M2 is done: [[M2-check]].

## Done
- M3-01 program schema, PR #22 (branch `m3-01-program-schema`): programs, versions, sessions and typed items ([[db]]).
  A program has one draft and frozen published versions. `save_program_draft` replaces the whole draft. `publish_program` freezes it.
  The first version is live today in India; later versions start tomorrow. `valid_prescription` checks rounds, time and sets.
- M3-05 schedule maths, PR #23 (branch `m3-05-schedule`, stacked on #22): `addDays`, `programDay`, `sessionsOn` in `packages/core`.
- M3-03 invites, database part only (branch `m3-03-invites`, stacked on #23, pushed, no PR yet): `invites`, `enrollments`,
  `program_invite`, `reset_invite`, `invite_info`, `join_program`, `program_members`. pgTAP passes. Codex: concurrent join fixed;
  the invite-creation race was rejected, because `own_draft` locks the program row first.

## Bugs and errors
- `valid_prescription` returned null for a missing number, so a bad prescription passed. It now treats null as invalid.
- The programs and versions policies recursed into each other; security-definer helpers `owns_program` and `program_is_published` break the loop.
- GitHub API timed out for several minutes; retry pushes with `timeout 150 git push`, and pass `--head` to `gh pr create`.

## Decisions
- The `/goal` for M2 said "write tests first", which cannot be repaired after the fact and trapped the stop hook. The M3 goal says "add tests that fail without the code" instead.

## Next
1. Wait for CI on #22 and #23, then merge them in order.
2. Open the M3-03 PR (database part), then build M3-02 builder and programs list (K-Programs, C-Builder), then the M3-03 screens: `/coach/programs/[id]/invite` (K-Invite, K-ConfirmReset) and `/join/[code]` (A-Invite).
3. Then M3-04 (leave, remove, `coach_can_read`), M3-06 Today, and on through the M3 list on the board.
