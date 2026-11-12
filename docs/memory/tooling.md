---
name: tooling
type: area
description: Claude Code tools, plugins, skills and permissions for this project
updated: 2026-11-12
---

- Permissions: `.claude/settings.json` lists commands that run without a prompt. Audited in [[session-6]]: auto mode blocks Claude from editing permission files or merging PRs, so the owner applies the allow list. A proposed list (git, gh pr/run, npm, npx supabase/playwright, docker, with deny rules for force-push, secrets, `supabase db push`/`link` and Vercel) was handed to the owner.
- Bun 1.4.4 installed with winget on [[env-lenovo-pc]] in [[session-6]]; gstack setup now passes. Only `/cso` fails (needs the MSVC toolchain); it is switched off anyway.
- Codex CLI 0.167.2 installed globally with npm; `~/.codex/config.toml` sets `model = "gpt-6-astra"`. Needs `codex login` by the owner. The Claude Code Codex plugin is not installed yet.
- The `github` Claude plugin fails to connect (bad Authorization header). `gh` does the same work, so it is not needed.
- Plugins: ponytail, ui-ux-pro-max, hallmark skill ([[lesson-hallmark-floor]]), OpenSEO, claude-seo (off until launch, [[lesson-seo-plugins]]).
- History: [[lesson-bun-gstack]].
- `gh` push of workflow files: [[lesson-gh-workflow-scope]].
- `skills` CLI: [[lesson-skills-cli-node]].
