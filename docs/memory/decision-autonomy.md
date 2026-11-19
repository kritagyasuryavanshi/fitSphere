---
name: decision-autonomy
type: decision
description: 2026-11-19: the owner wants Claude to work end to end without asking; only money, accounts and destroying data still need the owner
updated: 2026-11-19
---

On 2026-11-19 the owner said: "lets speed up the process from now on i dont want you take my permission just do what you think best".

**Why:** the owner wants a showcase and sellable version fast (see [[project-overview]]); the approval steps were the main delay.

**How to apply:**
- Build, test, review, push migrations to production (`db push --remote`, after a green CI run and the dry run), merge, deploy, and check the live site without asking. This widens [[decision-merge-deploys]].
- Still stop for the owner: anything that spends money or needs their accounts (domain, Resend, Razorpay, API keys), and anything that destroys data (deleting users' data, wiping a database). Never force-push.
- The quality bar does not change: tests first, Codex plus `/code-review high`, `/security-review` for access changes, green CI on the head commit.
- `.claude/settings.json` "ask" rules still prompt; the owner may move them to "allow" via `/permissions`. Claude cannot edit its own permissions.
