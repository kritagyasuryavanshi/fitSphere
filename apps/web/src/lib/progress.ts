// Progress records (M3-11), built only from the M3-10 rules in packages/core metrics.ts (docs/plans/m3-metrics.md).
import { bestOf, isNewRecord, recordType, type Best, type RecordType } from '@fitsphere/core';

type HistoryLog = {
  on_date: string;
  item_logs: { item_id: string | null; set_logs: { reps: number; load_kg: number | string | null }[] }[];
};
/** Progress pages group sports: boxing with S&C, gym on its own. Records compare only within a group. */
export const SPORT_GROUPS = { training: ['boxing', 'sc'], gym: ['gym'] } as const;
export const sportGroup = (category: string) => (category === 'gym' ? SPORT_GROUPS.gym : SPORT_GROUPS.training);

export type ExerciseRecord = { itemId: string; type: RecordType; best: Best; first: Best; isNew: boolean };

/**
 * Each exercise's best set over the logs, its first logged best (the baseline), and whether the best on `onDate`
 * beats every earlier one. An exercise with any loaded set has load records; otherwise rep records.
 */
export function records(history: HistoryLog[], onDate: string): ExerciseRecord[] {
  const byItem = new Map<string, { date: string; sets: { reps: number; loadKg: number | null }[] }[]>();
  for (const log of history) {
    for (const i of log.item_logs) {
      if (!i.item_id || !i.set_logs.length) continue;
      const sets = i.set_logs.map((s) => ({ reps: s.reps, loadKg: s.load_kg === null ? null : Number(s.load_kg) }));
      byItem.set(i.item_id, [...(byItem.get(i.item_id) ?? []), { date: log.on_date, sets }]);
    }
  }
  return [...byItem].flatMap(([itemId, sessions]) => {
    const type = recordType({ type: 'sets', loaded: sessions.some((s) => s.sets.some((x) => x.loadKg !== null)) })!;
    const best = bestOf(type, sessions);
    if (!best) return [];
    const firstDate = sessions.map((s) => s.date).sort()[0]!;
    const first = bestOf(type, sessions.filter((s) => s.date === firstDate)) ?? best;
    const isNew = isNewRecord(type, bestOf(type, sessions.filter((s) => s.date < onDate)), bestOf(type, sessions.filter((s) => s.date === onDate)));
    return [{ itemId, type, best, first, isNew }];
  });
}
