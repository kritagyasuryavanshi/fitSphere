---
name: design-system
type: area
description: packages/ui components, tokens, and what is deferred
updated: 2026-11-12
---

Built in [[S0-03]] ([[session-5]]). The look is Fight Camp: [[decision-fight-camp]].

- Components: tokens, Button, Tag, Input, Checkbox, RadioCard, Tabs, Dialog.
- Link buttons use `buttonClass()` with `next/link`.
- Tailwind reads the package through `@source` in `apps/web/src/app/globals.css`.
- Added beyond the board's list: a `danger` Button for the confirm screens, and a Dialog `alert` mode that keeps focus off the destructive button.
- Deferred: checkbox cards from A-Onboard1 go in [[M1-03]]. Pill-style category links (C-Library) are links, not tabs, and go in [[M2-03]].
- The real-browser check (axe with contrast, sizes, focus rings, dialog keyboard at 390 and 1440 px) ran as a one-off script. Move it into Playwright at [[S0-07]]. It found a bug jsdom missed: default buttons were 52 px, not 48 px.
- Quality floor: [[lesson-hallmark-floor]].
