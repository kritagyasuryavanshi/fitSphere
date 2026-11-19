// Coach dashboard flags (M3-12). The rules are written down in docs/plans/m3-metrics.md.
import { addDays } from '@fitsphere/core';

export type CoachFlag = { type: 'pain' } | { type: 'missed'; count: number } | { type: 'effort' };

export const MISSED_IN_A_ROW = 3;
export const HIGH_EFFORT = 9;

type Input = {
  /** Sessions the athlete's programs scheduled, in date order, with whether each was finished. */
  scheduled: { date: string; done: boolean }[];
  /** Finished sessions with every drill effort and set RPE logged in them. */
  finished: { date: string; efforts: number[] }[];
  /** Dates the athlete reported pain. */
  painDates: string[];
  today: string;
};

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

export function coachFlags({ scheduled, finished, painDates, today }: Input): CoachFlag[] {
  const flags: CoachFlag[] = [];
  if (painDates.some((d) => d >= addDays(today, -6) && d <= today)) flags.push({ type: 'pain' });

  // Today's and later sessions can still be done, so the run of misses ends yesterday.
  const past = scheduled.filter((s) => s.date < today);
  let run = 0;
  for (let i = past.length - 1; i >= 0 && !past[i]!.done; i--) run++;
  if (run >= MISSED_IN_A_ROW) flags.push({ type: 'missed', count: run });

  const lastTwo = finished
    .filter((s) => s.efforts.length)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-2);
  if (lastTwo.length === 2 && lastTwo.every((s) => mean(s.efforts) >= HIGH_EFFORT)) flags.push({ type: 'effort' });
  return flags;
}
