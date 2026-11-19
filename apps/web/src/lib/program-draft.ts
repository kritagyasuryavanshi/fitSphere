// The program builder's state, and the payload save_program_draft takes (M3-02).
// The ranges mirror valid_prescription in packages/db/supabase/migrations/20261114000000_programs.sql.

export type PrescriptionType = 'rounds' | 'time' | 'sets';
export type Numbers = { rounds?: number; work_s?: number; rest_s?: number; seconds?: number; sets?: number; reps?: number; load_kg?: number | null };
export type Prescription = Numbers & { type: PrescriptionType };
/** unavailable: the drill is no longer published, so saving fails until the coach removes it. */
export type DraftItem = Prescription & { key: string; item: string; title: string; cue: string; unavailable?: boolean };
export type DraftSession = { key: string; week: number; day: number; title: string; items: DraftItem[] };

export const typeLabels: Record<PrescriptionType, string> = { rounds: 'Rounds', time: 'Time', sets: 'Sets and reps' };

const fields: Record<PrescriptionType, (keyof Numbers)[]> = {
  rounds: ['rounds', 'work_s', 'rest_s'],
  time: ['seconds'],
  sets: ['sets', 'reps', 'load_kg'],
};

const duration = (s: number) => (s >= 60 && s % 60 === 0 ? `${s / 60} min` : `${s} s`);

/** "3 × 2 min · rest 45 s", "45 s", "3 × 15 · 16 kg". */
export function describePrescription(type: PrescriptionType, p: Numbers): string {
  if (type === 'rounds') return `${p.rounds} × ${duration(p.work_s ?? 0)}${p.rest_s ? ` · rest ${duration(p.rest_s)}` : ''}`;
  if (type === 'time') return duration(p.seconds ?? 0);
  return `${p.sets} × ${p.reps}${p.load_kg != null ? ` · ${p.load_kg} kg` : ''}`;
}

/** What a new item starts with: boxing work goes in rounds, everything else in sets. */
export function defaultPrescription(categoryId: string): Prescription {
  return categoryId === 'boxing' ? { type: 'rounds', rounds: 3, work_s: 120, rest_s: 60 } : { type: 'sets', sets: 3, reps: 10, load_kg: null };
}

/** The numbers a type starts with when the coach switches to it. */
export function startingNumbers(type: PrescriptionType): Numbers {
  return { rounds: { rounds: 3, work_s: 120, rest_s: 60 }, time: { seconds: 60 }, sets: { sets: 3, reps: 10, load_kg: null } }[type];
}

/** A whole number from min to max; anything else, including undefined, is false. */
export const whole = (v: unknown, min: number, max: number) => Number.isInteger(v) && (v as number) >= min && (v as number) <= max;

/** The first number out of range, as a sentence, or null when the database will accept it. */
export function prescriptionError(p: Prescription): string | null {
  if (p.type === 'rounds') {
    if (!whole(p.rounds, 1, 30)) return 'Rounds must be 1 to 30.';
    if (!whole(p.work_s, 10, 3600)) return 'Work must be 10 to 3600 seconds.';
    if (!whole(p.rest_s, 0, 1800)) return 'Rest must be 0 to 1800 seconds.';
  } else if (p.type === 'time') {
    if (!whole(p.seconds, 10, 14400)) return 'Time must be 10 to 14400 seconds.';
  } else {
    if (!whole(p.sets, 1, 20)) return 'Sets must be 1 to 20.';
    if (!whole(p.reps, 1, 200)) return 'Reps must be 1 to 200.';
    // The same text check as the database, so 2.3 passes although 2.3 * 100 is not a whole number in floating point.
    const load = p.load_kg;
    if (load != null && !(/^\d{1,3}(\.\d{1,2})?$/.test(String(load)) && load <= 500)) return 'Load must be 0 to 500 kg, with up to 2 decimals.';
  }
  return null;
}

/** A copy with entry i moved one place up (-1) or down (1). */
export function move<T>(list: T[], i: number, delta: -1 | 1): T[] {
  const j = i + delta;
  if (j < 0 || j >= list.length) return list;
  const next = [...list];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

type StoredSession = {
  week: number;
  day: number;
  position: number;
  title: string;
  session_items: { position: number; item_id: string; type: string; prescription: unknown; cue: string }[];
};

/** A version's sessions as one comparable string, so a save that changed nothing does not count as unpublished changes. */
export function sessionsKey(sessions: StoredSession[]): string {
  const sorted = [...sessions].sort((a, b) => a.position - b.position);
  return JSON.stringify(
    sorted.map((s) => [
      s.week,
      s.day,
      s.title,
      [...s.session_items].sort((a, b) => a.position - b.position).map((i) => [i.item_id, i.type, JSON.stringify(i.prescription), i.cue]),
    ]),
  );
}

export const maxWeekUsed =(sessions: DraftSession[]) => Math.max(1, ...sessions.map((s) => s.week));

/** The JSON save_program_draft takes: sessions in week and day order, each item with only its type's numbers. */
export function toPayload(sessions: DraftSession[]) {
  return [...sessions]
    .map((s, i) => ({ s, i }))
    .sort((a, b) => a.s.week - b.s.week || a.s.day - b.s.day || a.i - b.i)
    .map(({ s }) => ({
      week: s.week,
      day: s.day,
      title: s.title.trim(),
      items: s.items.map((it) => {
        const numbers: Numbers = {};
        for (const f of fields[it.type]) if (it[f] != null) Object.assign(numbers, { [f]: it[f] });
        return { item: it.item, type: it.type, ...numbers, cue: it.cue.trim() };
      }),
    }));
}
