---
name: lesson-conflict-skips-ci
type: lesson
description: 2026-11-19: a PR with a merge conflict gets no CI run; board.html conflicts are fixed by regenerating it
updated: 2026-11-19
---

In [[session-12]], PR #24 showed "no checks reported". It was not Actions or billing: GitHub does not run `pull_request` workflows while a PR conflicts with its base. `gh pr view N --json mergeable,mergeStateStatus` shows `CONFLICTING` / `DIRTY`.

- The usual conflict is `docs/plans/board.html`, which is generated. Merge `main` into the branch (a merge commit, so no force-push), run `python docs/plans/build_board.py`, and commit.
- Rebasing a pushed branch needs a force-push, which needs the owner's approval ([[constraints]]). Merge instead.
- Stacked PRs: open the next PR against the previous branch, then `gh pr edit N --base main` once the one below merges.

See [[ci]], [[build-board]].
