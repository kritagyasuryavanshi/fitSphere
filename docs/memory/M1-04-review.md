---
name: M1-04-review
type: lesson
description: 2026-11-12: findings from the planner, /code-review and Codex on PR #7 (M1-04), and how each was resolved
updated: 2026-11-12
---

All fixed in `7159a73` ([[M1-04]], [[session-9]]). Owner took the recommended choices.
1. Two AI consents: `ai_health_personalisation` (injury notes) and `ai_body_metrics` (weight and height).
2. Each consent is a required yes/no with nothing pre-chosen, so every answer is explicit.
3. Consent rows carry `notice_version` and are written only when the answer or the notice changes.
4. Steps 3 and 4 need step 2 done (`stepTwoDone` in `welcome/guard.ts`).
5. SQL checks answers: chosen sports only; short strings or lists of them (`apply_sport_answers`).
6. Step 2 and step 3 each save in one transaction.
7. The M1-03 migration is restored; `20261112400000_no_age_limit.sql` replaces `complete_about_you` ([[decision-no-age-limit]]).
8. Sign-up edits the latest measurement; both fields empty removes it. Strict decimal input.
9. Step 4 Back still goes to step 3, which sends non-gym users to step 2. Kept: it works and the page shell is static.

Lessons:
- Next 16 keeps visited routes mounted but hidden. Key forms on their saved data, or a reused radio ignores a new `defaultChecked`. In e2e, filter locators with `visible: true`.
- Do not force-check a visually hidden radio in Playwright: the click lands on the 1 px box centre and can hit a neighbour. Click the label.
- Codex flagged partial measurement updates; rejected, because step 3 prefills both values and edits in place.
