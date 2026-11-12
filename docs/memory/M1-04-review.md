---
name: M1-04-review
type: lesson
description: 2026-11-12: open findings from the planner and /code-review on PR #7 (M1-04), not yet fixed
updated: 2026-11-12
---

Fix before merging PR #7 ([[M1-04]], [[session-9]]):
1. One consent row covers injury notes and body weight, but step 3 copy says weight needs its own switch. Owner: one purpose or two (recommended two).
2. Consent is a checkbox, so "no" is not an explicit answer. Owner: required yes/no radio (recommended).
3. Consent rows repeat on every step-2 save; insert only when the answer changes. Consider `notice_version` now.
4. A user can skip step 2 by typing /welcome/4, so no basics or consent row exists. Guard step 4 on athlete_basics.
5. save_sport_answers and save_training_basics accept any values by direct RPC. Validate in SQL: strings of 40 characters or fewer.
6. Step 2 makes two RPCs with no transaction; merge into one function.
7. Done: the M1-03 migration is restored; `20261112400000_no_age_limit.sql` replaces complete_about_you.
8. Body metrics: cannot clear or fix a saved value; the pair compare hides a cleared height. Number() accepts 0x48 and 1e2; use a decimal regex.
9. Small: step 4 Back href from sports; textarea error not linked by aria; CRLF counts against the 500 limit; step 1 should reuse FieldError and SubmitRow.
