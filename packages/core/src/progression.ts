export type LoggedSet = { reps: number; loadKg: number | null };
export type Target = { loadKg: number; change: 'increase' | 'keep' };

/**
 * The load to try next time (M3-08), from last time's sets of the same exercise. The top of the rep range is the
 * coach's prescribed reps. If all the planned sets were done and every one reached it, add 2.5 kg to the heaviest
 * load used; otherwise keep that load.
 * Bodyweight work (no load) has no target. Loads are rounded to two decimals, as the database stores them.
 */
export function nextTarget(topReps: number, plannedSets: number, sets: LoggedSet[]): Target | null {
  const loads = sets.map((s) => s.loadKg).filter((l): l is number => l !== null);
  if (!loads.length) return null;
  const heaviest = Math.max(...loads);
  const allHit = sets.length >= plannedSets && sets.every((s) => s.reps >= topReps);
  const cents = Math.round(heaviest * 100) + (allHit ? 250 : 0);
  return { loadKg: cents / 100, change: allHit ? 'increase' : 'keep' };
}
