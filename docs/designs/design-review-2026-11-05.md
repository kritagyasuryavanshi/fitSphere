# Design Review, 2026-11-05: Owner Decisions D1 to D6

The owner approved all six design observations from `docs/architecture/product-analysis.md` §6. This file records each decision, what changed, and how it was checked. Screenshots: `docs/mockups/screenshots/before/` and `docs/mockups/screenshots/after/` (390 px phone, 1440 px desktop). Canvas: https://claude.ai/artifact/YVnwgT8qzwA2SerCSPasBe (version 27).

## Decisions and changes

| ID | Decision | What changed | Files |
|---|---|---|---|
| D1 | Fix the stale titles only | "Sign up step 3: Ready" is now "Sign-up step 4: Ready". "Onboarding" is now "Sign-up step 2: Experience". Step 1 title spelling matched. No layout change. | `C-Onboarding.dc.html`, `build/pages_learn_auth.py` |
| D2 | Review the five most-used phone screens by eye and fix real issues | Reviewed Landing, Boxing library, Ask AI, Search and Today from real 390 px screenshots. Fixes, applied through the phone generator so every phone screen gets them: (1) photo-tile grids show two per row instead of one huge tile; (2) filter panels and the AI question history become a closed toggle above the content; (3) sticky bars (the AI question box) sit above the bottom tabs instead of behind them; (4) Today's Friday label reads "Train" instead of "2". Search needed no change. Coach cards stay one per row because they hold text. | `build/phone.py`, `build/pages_rest.py` |
| D3 | Stacked cards instead of sideways-scrolling tables on phones | Coach dashboard, My lessons and Clients tables become cards on phones: name as the title, each column as a label and value row, actions at the bottom. Desktop tables unchanged. | `build/phone.py` (`tables_to_cards`) |
| D4 | Keep server-side branching for under-18 | No change. | None |
| D5 | Keep demo users (Kabir for boxing, Neha for gym); one data model | No design change. The architecture states one model: one `profiles` table, sport-specific preferences as rows, categories as data, so a new sport needs rows, not code. Board tasks M1-04 and M2-01 test this. | `docs/architecture/architecture.md` §4.3, board |
| D6 | Design every missing screen before its task starts | 9 new screens, each with a phone version, linked from existing screens (see below). | `build/pages_gaps.py`, small link additions in `pages_market.py`, `pages_athlete.py`, `pages_rest.py` |

## New screens (D6)

| Gap | Screen(s) | Reached from |
|---|---|---|
| G1 1:1 session booking | X-Book (week of slots, video or in person, note, pay) · X-Booked (confirmation, calendar, move or cancel) | Coach profile: "Single 1:1 session" package and the free-slot grid |
| G2 Cancel paid coaching | X-ManageCoaching (plan, next payment, payment method, booked sessions) · X-CancelCoaching (what happens, optional reason, confirm) | Coaching starts → "Manage coaching"; Account menu → "Coaching and payments" |
| Notifications | T-Notifications (recent items, mark read, email preferences per event) | Account menu → "Notifications" |
| G3 + G6 Coach empty states and first run | K-CoachEmpty (4-step setup checklist, empty athletes, requests and lessons) | First visit after an admin makes someone a coach |
| G4 Report abuse | X-Report (reason, details, privacy note) · X-ReportSent · R-Reports (admin queue: hide, suspend, dismiss) | "Report" under each review and in the chat header; admin People page → "Reports" |

Still open, with board tasks: G5 invoices list, G7 email templates, G8 offline page.

## How it was checked

- Link and markup check over all 151 boards: every link opens an existing screen, phone screens link only to phone screens, tags balance, no leftover placeholders. Result: 0 problems.
- Overflow check of every phone screen at 390 px. Result: nothing wider than the screen. Tables that were scrolling sideways are now cards.
- Real-browser screenshots (Chrome, local photos) of the five reviewed phone screens before and after, the three card conversions, and every new screen on phone and desktop.
- Phone page height went down for the reviewed screens: Landing 9,223 → 5,729 px; Boxing library 6,839 → 2,835 px; Ask AI 2,335 → 1,924 px.

## Not changed (on purpose)

- No change to desktop layouts, the Fight Camp look, copy or features beyond the approved items.
- Other wide tables on phones (athlete logs, people and roles, earnings, records, compare, rep ranges) still scroll inside their own box. They were not in the D3 scope. Raise them if you want cards there too.
