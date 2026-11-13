---
name: lesson-auto-mode-merge
type: lesson
description: Claude Code auto mode blocks Claude from merging its own PRs
updated: 2026-11-12
---

`gh pr merge` was denied as "merge without review" in [[session-6]], even though CLAUDE.md allows pushes to main. The owner merges PRs, or adds a permission rule. See [[ci]], [[tooling]].

Still blocked after the owner applied an allow list with `Bash(gh pr:*)` in the same session. Either the classifier overrides allow rules for merges, or new rules load only at session start. Test once in a fresh session; if still blocked, the owner merges.
