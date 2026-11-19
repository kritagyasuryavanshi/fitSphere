import type { TimerPlan } from '@fitsphere/core';
import type { Numbers, PrescriptionType } from './program-draft';

/** The round timer for a drill: rounds of work and rest, or one timed block. Sets have no timer. */
export function timerPlan(type: PrescriptionType, p: Numbers): TimerPlan | null {
  if (type === 'rounds') return { rounds: Number(p.rounds), workS: Number(p.work_s), restS: Number(p.rest_s) };
  if (type === 'time') return { rounds: 1, workS: Number(p.seconds), restS: 0 };
  return null;
}

/** The player runs any session with something in it: a timer for rounds and timed drills, the set logger for sets. */
export const playable = (items: { type: string }[]) => items.length > 0;

type HistoryLog = { id: string; on_date: string; started_at: string; item_logs: { item_id: string | null; set_logs: { set_no: number; reps: number; load_kg: number | null }[] }[] };
export type LastTime = { date: string; sets: { reps: number; loadKg: number | null }[] };

/** Last time's sets of an exercise: the latest other session log where it has sets. */
export function lastTime(history: HistoryLog[], itemId: string, currentLogId: string | null): LastTime | null {
  const sorted = [...history].sort((a, b) => b.on_date.localeCompare(a.on_date) || b.started_at.localeCompare(a.started_at));
  for (const log of sorted) {
    if (log.id === currentLogId) continue;
    const sets = log.item_logs.filter((i) => i.item_id === itemId).flatMap((i) => i.set_logs);
    if (sets.length) {
      return {
        date: log.on_date,
        sets: [...sets].sort((a, b) => a.set_no - b.set_no).map((s) => ({ reps: s.reps, loadKg: s.load_kg === null ? null : Number(s.load_kg) })),
      };
    }
  }
  return null;
}

/** Kilograms as typed: blank is bodyweight (null); otherwise 0 to 500 with up to two decimals, else undefined. */
export function parseLoad(text: string): number | null | undefined {
  const t = text.trim();
  if (!t) return null;
  if (!/^\d{1,3}(\.\d{1,2})?$/.test(t)) return undefined;
  const n = Number(t);
  return n <= 500 ? n : undefined;
}

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
