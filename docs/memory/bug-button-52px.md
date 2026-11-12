---
name: bug-button-52px
type: bug
status: fixed
description: Default buttons rendered 52 px tall instead of 48 px
updated: 2026-11-09
---

Found by the one-off real-browser check in [[session-5]]. jsdom tests could not see it. Fixed in [[S0-03]] ([[design-system]]).

The real-browser check moves into Playwright at [[S0-07]] so this class of bug is caught in CI.
