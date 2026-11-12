---
name: lesson-gh-workflow-scope
type: lesson
description: Pushing .github/workflows needs the gh workflow scope and gh as the git credential helper
updated: 2026-11-12
---

GitHub rejects the push with "refusing to allow an OAuth App to create or update workflow without workflow scope". Fix: `gh auth refresh -h github.com -s workflow`, then `gh auth setup-git`. Done on [[env-lenovo-pc]] in [[session-6]]. See [[ci]].

Side effect: `gh auth setup-git` sets the gh helper for all of `https://github.com`, which breaks pushes to repos of the other account (`Akash9179`). Scope it instead: unset `credential.https://github.com.helper`, then add `credential.https://github.com/kritagyasuryavanshi.helper` as `""` followed by the gh helper.
