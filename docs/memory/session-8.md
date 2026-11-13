---
name: session-8
type: session
description: 2026-11-12: M1-01 identity schema with RLS, model routing from the blog, tooling audit and fixes
updated: 2026-11-12
date: 2026-11-12
pc: lenovo
---

## Done
- [[M1-01]] identity schema with RLS ([[db]]). PR #4, stacked on PR #3. 29 pgTAP checks, CI green.
- Planner review found 2 defects and 1 gap. All are fixed with regression tests. `/security-review` found 1 robustness bug, now fixed.
- The model routing in the global rulebook now follows the Claude model-choice blog ([[tooling]]).
- Tooling audit page with fixes ([[tooling]]). `doctor.sh` GREEN, settings drift fixed, CI actions on v5.

## Bugs and errors
- PRs #1 to #3 were not merged on GitHub, though the owner thought so.
- `node_modules` went stale again ([[lesson-stale-node-modules]]).
- `/security-review` crashed: `origin/HEAD` unset ([[tooling]]).
- The github plugin fails: `GITHUB_PERSONAL_ACCESS_TOKEN` is unset ([[tooling]]). Open.
- The rulebook push still gets 403 ([[lesson-gh-workflow-scope]]). Open.

## Decisions
- Revoking a user's athlete role is allowed; it works as a suspension ([[M1-01]] review default).

## Needs you
- Merge PRs #1, #2, #3 and #4, in order.
- Set the GitHub token, run the rulebook push command, and switch off the unused plugins ([[owner-decisions]]).

## Next
- [[M1-02]] sign in with email link or Google. Local email works without accounts; Google needs [[O-02]].
- `/code-review` at high on the M1-01 diff is still owed.
