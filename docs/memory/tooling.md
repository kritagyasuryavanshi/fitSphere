---
name: tooling
type: area
description: Claude Code tools, plugins, skills and permissions for this project
updated: 2026-11-12
---

- Permissions: `.claude/settings.json` lists commands that run without a prompt. Audited in [[session-6]]: auto mode blocks Claude from editing permission files or merging PRs, so the owner applies the allow list. A proposed list (git, gh pr/run, npm, npx supabase/playwright, docker, with deny rules for force-push, secrets, `supabase db push`/`link` and Vercel) was handed to the owner.
- Bun 1.4.4 installed with winget on [[env-lenovo-pc]] in [[session-6]]; gstack setup now passes. Only `/cso` fails (needs the MSVC toolchain); it is switched off anyway.
- No Codex: the owner has no Codex subscription (2026-11-12). Independent reviews use a Claude subagent instead (the `planner` agent or `/code-review`). The Codex CLI 0.167.2 is installed but unused.
- The `github` Claude plugin fails with 400 because its `.mcp.json` sends `Bearer ${GITHUB_PERSONAL_ACCESS_TOKEN}` and that variable is unset ([[session-8]]). Fix: the owner sets it from `gh auth token`, or switches the plugin off. 2026-11-12: the owner set a fine-grained `github_pat_` token on [[env-lenovo-pc]] with `setx`. It was unset in the Claude Code shell, so the owner set it again as a user variable ([[session-9]]). Next session: run `/mcp` to confirm it connects, then rotate the token, because it appeared in the chat. The WELCOME PC needs the same step.
- Full audit with verdicts per plugin, connector and skill: https://claude.ai/artifact/NAWsRxJUah4godqxBrXA6T ([[session-8]]). Proposed off: ui-ux-pro-max, openseo (until M6), typesafe, swift-lsp. Remove the Neon connector (write mode, unused).
- Model routing follows the Claude model-choice blog (2026-11-09): Opus medium by default, Sonnet for scoped helper and review agents, Haiku for reading, Fable for planning and high-risk review ([[session-8]]).
- `suryavanshi-claude` scripts call `python3`; on Windows that is a Store stub, so they now fall back to `python`. `doctor.sh` is GREEN; 3 `test.sh` symlink checks need Windows Developer Mode.
- `/security-review` needs `origin/HEAD`: `git remote set-head origin main` on each clone.
- Plugins: ponytail, ui-ux-pro-max, hallmark skill ([[lesson-hallmark-floor]]), OpenSEO, claude-seo (off until launch, [[lesson-seo-plugins]]).
- History: [[lesson-bun-gstack]].
- `gh` push of workflow files: [[lesson-gh-workflow-scope]].
- `skills` CLI: [[lesson-skills-cli-node]].
