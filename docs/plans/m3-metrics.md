# M3 training metrics: the rules

These are the rules behind every training number fitSphere shows. Each rule has one home in code and tests with exact values. The progress pages (M3-11) and the coach dashboard (M3-12) must use these functions and must not compute their own versions.

| Metric | Rule | Code | Tests |
|---|---|---|---|
| Adherence | Sessions completed ÷ sessions scheduled, from each active enrollment's start date up to today, **including today**. A session counts as completed when its log is finished (`completed_at`); logged but unfinished does not count. Shown as a whole percent, rounded down, so 100 % means every session. There is no figure until something is scheduled. A program the athlete left drops out. The schedule follows the version in effect on each date, as Today does. | SQL `adherence(athlete, program)`; `adherence()` in `packages/core/src/metrics.ts` for the percent | `metrics_test.sql`, `metrics.test.ts` |
| Hard set | A logged set with at least 1 rep at effort RPE 7 or more (about three reps or fewer short of failure). A failed attempt (0 reps) is never hard. | `isHardSet`, `HARD_SET_RPE` in `metrics.ts`; the same condition in SQL | both |
| Sets per muscle | Hard sets from **gym** logs only (S&C and boxing logs never count, whatever the exercise), between two dates or within one session log. Each set counts once, for the exercise's one primary muscle (a unique index enforces one). An exercise whose primary muscle is not visible to the reader (no longer published) adds nothing. The workout summary's Hard sets figure is gym-only too. | SQL `hard_sets_per_muscle(athlete, from, to)` | `metrics_test.sql` |
| Skill rating | For each drill, the mean technique feel (1–5) of its last 5 logs, to one decimal. Newest by date, then by when the session log was first saved (`created_at`), then by position; editing or finishing a log does not reorder them. A drill with fewer logs averages what it has. Sets carry no technique and have no rating. | SQL `skill_ratings(athlete)`; `skillRating()` in `metrics.ts` | both |
| Record: load | For a loaded exercise, the heaviest load lifted for at least 1 rep. More reps at the same load breaks a tie. A later set has to beat the best to replace it, so a tie keeps the earliest date. | `bestOf('load', …)` | `metrics.test.ts` |
| Record: reps | For a bodyweight exercise, the most reps in one set. A tie keeps the earliest date. | `bestOf('reps', …)` | `metrics.test.ts` |
| New record | Today's best beats the best before today under the rules above. The first log of an exercise sets a baseline and is not a record. Rounds and timed drills have no records; their progress is the skill rating. | `isNewRecord`, `recordType` | `metrics.test.ts` |
| Next target | If every planned set reached the prescribed reps last time, add 2.5 kg to the heaviest load used; otherwise keep that load. Bodyweight work has no target. | `nextTarget` in `packages/core/src/progression.ts` | `progression.test.ts` |
| Session summary | Drills or exercises logged; rounds done against rounds planned; mean technique; sets, reps and volume (reps × kg, in whole cents). Every figure comes from the saved logs. | `summarise` in `apps/web/src/lib/session-summary.ts` | `session-summary.test.ts` |

## Who sees the numbers

The SQL functions run as the caller (security invoker), so row-level security decides what each person can see:

- the athlete always gets their own numbers;
- a coach gets an athlete's numbers only through `coach_reads_program`: logs from a program the coach owns, while the athlete is active in that program;
- anyone else gets nothing.

## Where the numbers show (M3-11)

- `/progress` (boxing and S&C) and `/progress/gym`: adherence from SQL `adherence` per program, skill ratings from `skill_ratings`, hard sets per muscle for the Monday to Sunday week from `hard_sets_per_muscle`, and records through `records()` in `apps/web/src/lib/progress.ts`, which only calls `bestOf` and `isNewRecord`.
- The workout summary marks each exercise whose best on that date beats every earlier date: "New best".
- Body weight: `log_body_weight` keeps one weight per India day. The athlete and their current coach (`coach_can_read`) read it.
