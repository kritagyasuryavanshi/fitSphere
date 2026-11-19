import { describe, expect, it } from 'vitest';
import { firstOpen, isIsoDate, isLoad, lastTime, parseLoad, playable, timerPlan } from './session-player';

describe('timerPlan', () => {
  it('times rounds as work and rest, and a timed drill as one round without rest', () => {
    expect(timerPlan('rounds', { rounds: 3, work_s: 120, rest_s: 45 })).toEqual({ rounds: 3, workS: 120, restS: 45 });
    expect(timerPlan('time', { seconds: 600 })).toEqual({ rounds: 1, workS: 600, restS: 0 });
  });
  it('has no timer for sets, which the set logger handles', () => {
    expect(timerPlan('sets', { sets: 3, reps: 10 })).toBeNull();
  });
});

describe('playable', () => {
  it('plays any session with drills or exercises', () => {
    expect(playable([{ type: 'rounds' }, { type: 'time' }])).toBe(true);
    expect(playable([{ type: 'rounds' }, { type: 'sets' }])).toBe(true);
    expect(playable([])).toBe(false);
  });
});

describe('lastTime', () => {
  const bench = 'bench';
  const history = [
    { id: 'now', on_date: '2026-11-19', started_at: '2026-11-19T10:00:00Z', item_logs: [{ item_id: bench, position: 1, set_logs: [{ set_no: 1, reps: 8, load_kg: 55 }] }] },
    { id: 'b', on_date: '2026-11-16', started_at: '2026-11-16T10:00:00Z', item_logs: [{ item_id: bench, position: 1, set_logs: [{ set_no: 2, reps: 7, load_kg: 50 }, { set_no: 1, reps: 8, load_kg: 50 }] }] },
    { id: 'a', on_date: '2026-11-12', started_at: '2026-11-12T10:00:00Z', item_logs: [{ item_id: bench, position: 1, set_logs: [{ set_no: 1, reps: 8, load_kg: 45 }] }] },
    { id: 'c', on_date: '2026-11-17', started_at: '2026-11-17T10:00:00Z', item_logs: [{ item_id: 'row', position: 1, set_logs: [{ set_no: 1, reps: 10, load_kg: 40 }] }, { item_id: bench, position: 2, set_logs: [] }] },
  ];
  it('takes the latest other session with sets of the same exercise, in set order', () => {
    expect(lastTime(history, bench, 'now')).toEqual({ date: '2026-11-16', sets: [{ reps: 8, loadKg: 50 }, { reps: 7, loadKg: 50 }] });
  });
  it('takes one block when the exercise was in the session twice: the same position, else the biggest', () => {
    const twice = [
      {
        id: 'x',
        on_date: '2026-11-18',
        started_at: '',
        item_logs: [
          { item_id: bench, position: 1, set_logs: [{ set_no: 1, reps: 8, load_kg: 60 }, { set_no: 2, reps: 8, load_kg: 60 }] },
          { item_id: bench, position: 4, set_logs: [{ set_no: 1, reps: 12, load_kg: 40 }, { set_no: 2, reps: 12, load_kg: 40 }, { set_no: 3, reps: 12, load_kg: 40 }] },
        ],
      },
    ];
    expect(lastTime(twice, bench, 'now', 1)?.sets).toEqual([{ reps: 8, loadKg: 60 }, { reps: 8, loadKg: 60 }]);
    expect(lastTime(twice, bench, 'now', 4)?.sets.map((s) => s.reps)).toEqual([12, 12, 12]);
    expect(lastTime(twice, bench, 'now', 2)?.sets.map((s) => s.reps)).toEqual([12, 12, 12]);
  });

  it('skips logs of the exercise without sets, and is null for a first time', () => {
    expect(lastTime(history, 'row', 'c')).toBeNull();
    expect(lastTime(history, 'squat', 'now')).toBeNull();
  });
  it('reads loads that PostgREST sends as strings', () => {
    expect(lastTime([{ id: 'x', on_date: '2026-11-01', started_at: '', item_logs: [{ item_id: bench, position: 1, set_logs: [{ set_no: 1, reps: 5, load_kg: '52.50' as unknown as number }] }] }], bench, 'now')?.sets[0]?.loadKg).toBe(52.5);
  });
});

describe('isLoad', () => {
  it('accepts every two-decimal load, including ones floating point gets wrong', () => {
    for (const n of [1.1, 0.57, 4.35, 0.55, 52.5, 0, 500]) expect(isLoad(n)).toBe(true);
    for (let c = 0; c <= 50000; c++) if (!isLoad(c / 100)) throw new Error(`refused ${c / 100}`);
  });
  it('refuses more decimals, negatives and over 500', () => {
    for (const n of [52.345, -0.5, 500.01, Number.NaN]) expect(isLoad(n)).toBe(false);
  });
});

describe('parseLoad', () => {
  it('reads kilograms with up to two decimals, blank as bodyweight', () => {
    expect(parseLoad('52.5')).toBe(52.5);
    expect(parseLoad(' 0 ')).toBe(0);
    expect(parseLoad('')).toBeNull();
    expect(parseLoad('500')).toBe(500);
  });
  it('refuses anything else', () => {
    expect(parseLoad('500.5')).toBeUndefined();
    expect(parseLoad('52.345')).toBeUndefined();
    expect(parseLoad('-5')).toBeUndefined();
    expect(parseLoad('52,5')).toBeUndefined();
  });
});

describe('firstOpen', () => {
  it('starts at the first drill not yet logged, or past the end when all are', () => {
    expect(firstOpen([1, 2, 3], [])).toBe(0);
    expect(firstOpen([1, 2, 3], [1, 3])).toBe(1);
    expect(firstOpen([1, 2, 3], [1, 2, 3])).toBe(3);
  });
});

describe('isIsoDate', () => {
  it('accepts real calendar dates only', () => {
    expect(isIsoDate('2026-11-19')).toBe(true);
    expect(isIsoDate('2026-02-30')).toBe(false);
    expect(isIsoDate('2026-1-9')).toBe(false);
    expect(isIsoDate('tomorrow')).toBe(false);
  });
});
