---
name: decision-no-age-limit
type: decision
description: 2026-11-12: no age limit; date of birth still asked once and kept. Replaces decision-adults-only.
updated: 2026-11-12
---

The owner removed the 18+ limit ([[session-9]]). Anyone can sign up. Step 1 still asks the date of birth once, and it cannot change ([[M1-03]]).
Replaces [[decision-adults-only]].

Why the date stays: minors must stay identifiable. India's DPDP Act needs verifiable parental consent before processing a child's data, and injury notes and body weight are health data ([[constraints]]).

Launch blocker: a parental-consent step for under-18s, confirmed by a lawyer, before any real minor signs up ([[owner-decisions]]).
Code: migration `20261112400000_no_age_limit.sql` drops `is_adult` and the block screen. A future date is still refused.
