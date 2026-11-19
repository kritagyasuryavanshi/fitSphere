import type { TimerPlan } from '@fitsphere/core';
import type { Numbers, PrescriptionType } from './program-draft';

/** The round timer for a drill: rounds of work and rest, or one timed block. Sets have no timer. */
export function timerPlan(type: PrescriptionType, p: Numbers): TimerPlan | null {
  if (type === 'rounds') return { rounds: Number(p.rounds), workS: Number(p.work_s), restS: Number(p.rest_s) };
  if (type === 'time') return { rounds: 1, workS: Number(p.seconds), restS: 0 };
  return null;
}

/** The boxing player runs sessions of rounds and timed drills. Sets need the set logger. */
export const playable = (items: { type: string }[]) => items.length > 0 && items.every((i) => i.type === 'rounds' || i.type === 'time');

/** The index of the first drill without a log; the length when every drill is logged. */
export function firstOpen(positions: number[], logged: number[]) {
  const i = positions.findIndex((p) => !logged.includes(p));
  return i === -1 ? positions.length : i;
}

export function isIsoDate(s: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}
