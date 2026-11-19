import { describe, expect, it } from 'vitest';
import { records } from './progress';

const log = (on_date: string, item_id: string, sets: [number, number | null][]) => ({
  on_date,
  item_logs: [{ item_id, set_logs: sets.map(([reps, load_kg]) => ({ reps, load_kg })) }],
});

describe('records', () => {
  it('gives each exercise its best set and the date, from bestOf', () => {
    const r = records([log('2026-11-02', 'squat', [[8, 60]]), log('2026-11-09', 'squat', [[8, 65], [5, 70]])], '2026-11-19');
    expect(r).toEqual([{ itemId: 'squat', type: 'load', best: { value: 70, reps: 5, date: '2026-11-09' }, first: { value: 60, reps: 8, date: '2026-11-02' }, isNew: false }]);
  });

  it('marks a new best on the date only when it beats the best before that date', () => {
    const history = [log('2026-11-02', 'squat', [[8, 60]]), log('2026-11-19', 'squat', [[8, 62.5]])];
    expect(records(history, '2026-11-19')[0]!.isNew).toBe(true);
    expect(records(history, '2026-11-02')[0]!.isNew).toBe(false);
  });

  it('a first log is a baseline, not a new best', () => {
    expect(records([log('2026-11-19', 'squat', [[8, 60]])], '2026-11-19')[0]!.isNew).toBe(false);
  });

  it('bodyweight work keeps rep records; a load as text from the database counts as a number', () => {
    const r = records([log('2026-11-02', 'pullup', [[3, null]]), log('2026-11-05', 'pullup', [[6, null]]), log('2026-11-05', 'bench', [[8, '52.50' as unknown as number]])], '2026-11-05');
    expect(r.find((x) => x.itemId === 'pullup')).toMatchObject({ type: 'reps', best: { value: 6 }, isNew: true });
    expect(r.find((x) => x.itemId === 'bench')).toMatchObject({ type: 'load', best: { value: 52.5, reps: 8 } });
  });

  it('skips logs whose exercise left the library, and exercises with only failed attempts', () => {
    const r = records([{ on_date: '2026-11-02', item_logs: [{ item_id: null, set_logs: [{ reps: 8, load_kg: 60 }] }] }, log('2026-11-02', 'squat', [[0, 100]])], '2026-11-19');
    expect(r).toEqual([]);
  });
});

