---
name: tooling
type: area
description: Claude Code tools, plugins, skills and permissions for this project
updated: 2026-11-12
---

- Permissions: `.claude/settings.json` lists commands that run without a prompt. Audited in [[session-6]].
- Plugins: ponytail, ui-ux-pro-max, hallmark skill ([[lesson-hallmark-floor]]), OpenSEO, claude-seo (off until launch, [[lesson-seo-plugins]]).
- gstack is installed but tools that need Bun fail ([[lesson-bun-gstack]]). Codex CLI is not installed, so outside reviews fall back to a Claude subagent.
- `gh` push of workflow files: [[lesson-gh-workflow-scope]].
- `skills` CLI: [[lesson-skills-cli-node]].
