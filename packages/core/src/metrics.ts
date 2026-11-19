/**
 * Training metrics (M3-10). The rules are written down in docs/plans/m3-metrics.md; the SQL functions in
 * 20261124000000_metrics.sql apply the same ones for adherence, hard sets per muscle and skill ratings.
 */

export type RecordType = 'load' | 'reps';
export type Best = { value: number; reps: number; date: string };
type Session = { date: string; sets: { reps: number; loadKg: number | null }[] };

/** Loaded sets have load records; bodyweight sets have rep records; rounds and timed drills have none. */
export function recordType(item: { type: 'rounds' | 'time' | 'sets'; loaded: boolean }): RecordType | null {
  if (item.type !== 'sets') return null;
  return item.loaded ? 'load' : 'reps';
}

const beats = (type: RecordType, a: Best, b: Best) => (type === 'load' ? a.value > b.value || (a.value === b.value && a.reps > b.reps) : a.value > b.value);

/**
 * The best set over sessions. load: the heaviest load lifted for at least one rep, with more reps breaking a tie.
 * reps: the most reps in one bodyweight set. A later set must beat the best to replace it, so ties keep the earliest.
 */
export function bestOf(type: RecordType, sessions: Session[]): Best | null {
  let best: Best | null = null;
  for (const s of [...sessions].sort((a, b) => a.date.localeCompare(b.date))) {
    for (const set of s.sets) {
      if (set.reps < 1) continue;
      if (type === 'reps' && set.loadKg !== null) continue;
      const value = type === 'load' ? set.loadKg : set.reps;
      if (value === null) continue;
      const candidate = { value, reps: set.reps, date: s.date };
      if (!best || beats(type, candidate, best)) best = candidate;
    }
  }
  return best;
}

/** A new record beats the best before it. The first log of an exercise sets a baseline, not a record. */
export function isNewRecord(type: RecordType, before: Best | null, now: Best | null) {
  return !!before && !!now && beats(type, now, before);
}

/** A hard set: at least one rep at effort (RPE) 7 or more, about three reps or fewer short of failure. */
export const HARD_SET_RPE = 7;
export const isHardSet = (s: { reps: number; rpe: number }) => s.reps >= 1 && s.rpe >= HARD_SET_RPE;

/** Completed over scheduled, as a whole percent rounded down, so 100 means every session; null with none scheduled. */
export function adherence(completed: number, scheduled: number): number | null {
  return scheduled > 0 ? Math.floor((completed * 100) / scheduled) : null;
}

/** The mean of the last five technique feels (newest first), to one decimal; null without any. */
export function skillRating(newestFirst: number[]): number | null {
  const last = newestFirst.slice(0, 5);
  if (!last.length) return null;
  return Math.round((last.reduce((a, b) => a + b, 0) * 10) / last.length) / 10;
}
