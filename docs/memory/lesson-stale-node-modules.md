---
name: lesson-stale-node-modules
type: lesson
description: Run npm ci after pulling on a PC that has been idle
updated: 2026-11-12
---

In [[session-6]], `verify` failed on [[env-lenovo-pc]]: `@supabase/supabase-js` was missing because `node_modules` predated [[S0-04]]. `npm ci` fixed it.

It happened again in [[session-8]]: `npm ci` on old `main`, then a switch to a branch with Playwright. Run `npm ci` after every branch switch that changes `package-lock.json`.
