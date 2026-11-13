---
name: mockups
type: area
description: Design canvas, mockup sources, build scripts and screenshot tooling
updated: 2026-11-12
---

- Canvas: https://claude.ai/artifact/YVnwgT8qzwA2SerCSPasBe. Look: [[decision-fight-camp]].
- Sources in `docs/mockups/`. Generators in `docs/mockups/build/`: `build.py` writes `.dc.html` from shared fragments. `phone.py` makes 390 px phone versions (`M-*.dc.html`). `pages_gaps.py` holds the gap screens.
- Photos: Unsplash, credits in `docs/mockups/images/CREDITS.md`. [[lesson-unsplash]].
- Demo people (fictional): coaches Vikram Rathore (boxing), Ananya Iyer (S&C), Rohan Desai (reviewer); athletes Kabir Malhotra and Neha (gym). Real coach photos replace the models before launch.
- Rule: canvas edits win. Before a rebuild, port hand edits into the sources.
- Rule: [[decision-no-design-edits]].
- Screenshots: playwright-core with installed Chrome; it sizes the window to the full page. [[lesson-headless-chrome-500px]].
- Design review record: `docs/designs/design-review-2026-11-05.md`, page https://claude.ai/artifact/DnbZRbQHPG74SwxnUg5Mft.
- Known typo, left alone: the confirm screens' warning icon path reads `M12 3l10 28H2z`; the correct one, used in [[design-system]], is `M12 3l10 18H2z`.
- History: [[session-2]], [[session-3]], [[session-3b]], [[session-3c]], [[session-3f]].
