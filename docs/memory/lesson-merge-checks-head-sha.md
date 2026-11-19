---
name: lesson-merge-checks-head-sha
type: lesson
description: 2026-11-19: before a merge, confirm the green CI run is for the PR's head commit, not an earlier push
updated: 2026-11-19
---

In [[session-12]], PR #29 merged while CI on its last commit was still pending. `gh pr checks 29 --watch` had started right after a push, before GitHub registered the new run, so it watched and passed the run for the commit before. The repo has no branch protection ([[ci]]), so nothing stopped the merge. The new run later passed too.

- Find the run by commit: `gh run list --branch <b> --json headSha,databaseId` and select the run whose `headSha` equals `git rev-parse HEAD`. Then `gh run watch <id> --exit-status`.
- Before `gh pr merge`, compare `gh pr view N --json headRefOid` with the watched run's `headSha`.
- A watcher that looks up `git rev-parse HEAD` in a loop breaks if the branch changes meanwhile. Take the SHA once, before the loop.

See [[ci]], [[lesson-conflict-skips-ci]].
