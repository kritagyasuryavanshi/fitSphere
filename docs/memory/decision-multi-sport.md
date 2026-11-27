---
name: decision-multi-sport
type: decision
description: 2026-11-27: FitSphere is multi-sport; boxing, general S&C and gym hypertrophy are equal paths; cricket only as planned
updated: 2026-11-27
---

The owner corrected the focus in [[session-18]]. FitSphere helps people learn skills, follow plans, build strength and work with coaches across sports. It is not a boxing app with other sports added around it.

- **Equal paths:** Boxing, Strength & Conditioning for any sport or everyday fitness, and Gym & Fitness with hypertrophy as a real path. Boxing stays fully supported.
- **No default sport:** shared screens follow the athlete's chosen sports (`athlete_prefs`) through `apps/web/src/lib/sports.ts`. With none chosen they show the whole library at `/learn`, never `/learn/boxing`.
- **Truthful availability:** a sport that is not live (cricket) shows only as planned or coming later. It needs real plans, content, tracking and coaching first.
- **Look:** Fight Camp stays ([[decision-fight-camp]]). Sign-in and sign-up use a plain ink panel; a sport photo fits only a screen about that sport.
- **Landing:** a moving carousel of what is live today (the owner asked for it), with pause, and still for reduced motion.

Supersedes [[decision-launch-sports]] ("boxing primary, S&C not a generic gym app"). The owner's request is the approval that [[decision-no-design-edits]] needs for these design changes.

The tagline migration `20261231000000_sport_taglines.sql` sets S&C to "Strength and power for any sport" and gym to "Hypertrophy, strength, fat loss". It reaches production only after the owner says yes to `db push --remote`.
