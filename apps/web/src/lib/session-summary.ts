export type SummaryItem = {
  position: number;
  title: string;
  type: 'rounds' | 'time' | 'sets';
  plannedRounds: number | null;
  log: { roundsDone: number | null; technique: number | null; effort: number | null; sets: { reps: number; loadKg: number | null }[] } | null;
};

export type Summary = {
  itemsLogged: number;
  items: number;
  /** Rounds done in logged drills, against rounds planned in every rounds drill, skipped ones included. */
  roundsDone: number;
  roundsPlanned: number;
  /** Mean technique feel of the logged drills, to one decimal; null when none has one. */
  technique: number | null;
  sets: number;
  reps: number;
  /** Reps times kilograms over every loaded set, to the cent. Bodyweight sets add reps but no load. */
  volumeKg: number;
};

/** The done summary (M3-09), computed from the saved logs only, so every number matches them exactly. */
export function summarise(items: SummaryItem[]): Summary {
  const logged = items.filter((i) => i.log && (i.type !== 'sets' || i.log.sets.length));
  const techniques = logged.map((i) => i.log!.technique).filter((t): t is number => t !== null);
  const sets = logged.flatMap((i) => i.log!.sets);
  // Whole cents, then whole kilogram-cents per set, so 0.1 + 0.2 stays 0.3.
  const volumeCents = sets.reduce((sum, s) => sum + (s.loadKg === null ? 0 : s.reps * Math.round(s.loadKg * 100)), 0);
  return {
    itemsLogged: logged.length,
    items: items.length,
    roundsDone: logged.reduce((sum, i) => sum + (i.log!.roundsDone ?? 0), 0),
    roundsPlanned: items.reduce((sum, i) => sum + (i.plannedRounds ?? 0), 0),
    technique: techniques.length ? Math.round((techniques.reduce((a, b) => a + b, 0) / techniques.length) * 10) / 10 : null,
    sets: sets.length,
    reps: sets.reduce((sum, s) => sum + s.reps, 0),
    volumeKg: volumeCents / 100,
  };
}

export function minutesBetween(from: string | null, to: string | null): number | null {
  if (!from || !to) return null;
  return Math.round((Date.parse(to) - Date.parse(from)) / 60_000);
}
