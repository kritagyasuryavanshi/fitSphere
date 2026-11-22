import { describe, expect, it } from 'vitest';
import { adherence, bestOf, isHardSet, isNewRecord, recordType } from './metrics';

describe('recordType', () => {
  it('is load for loaded sets, reps for bodyweight sets, and none for drills', () => {
    expect(recordType({ type: 'sets', loaded: true })).toBe('load');
    expect(recordType({ type: 'sets', loaded: false })).toBe('reps');
    expect(recordType({ type: 'rounds', loaded: false })).toBeNull();
    expect(recordType({ type: 'time', loaded: false })).toBeNull();
  });
});

describe('bestOf', () => {
  const sessions = [
    { date: '2026-11-10', sets: [{ reps: 8, loadKg: 50 }, { reps: 8, loadKg: 50 }, { reps: 6, loadKg: 50 }] },
    { date: '2026-11-13', sets: [{ reps: 5, loadKg: 55 }, { reps: 8, loadKg: 52.5 }] },
    { date: '2026-11-17', sets: [{ reps: 7, loadKg: 55 }, { reps: 0, loadKg: 60 }] },
  ];

  it('load: the heaviest load lifted for at least one rep, more reps breaking a tie, earliest date first', () => {
    expect(bestOf('load', sessions)).toEqual({ value: 55, reps: 7, date: '2026-11-17' });
    expect(bestOf('load', sessions.slice(0, 2))).toEqual({ value: 55, reps: 5, date: '2026-11-13' });
  });

  it('load: a failed attempt (0 reps) is never a record', () => {
    expect(bestOf('load', [{ date: '2026-11-17', sets: [{ reps: 0, loadKg: 60 }] }])).toBeNull();
  });

  it('reps: most reps in one bodyweight set, earliest date first on a tie', () => {
    const pushUps = [
      { date: '2026-11-10', sets: [{ reps: 15, loadKg: null }, { reps: 12, loadKg: null }] },
      { date: '2026-11-12', sets: [{ reps: 15, loadKg: null }] },
      { date: '2026-11-14', sets: [{ reps: 11, loadKg: null }] },
    ];
    expect(bestOf('reps', pushUps)).toEqual({ value: 15, reps: 15, date: '2026-11-10' });
  });

  it('is null with no sets', () => {
    expect(bestOf('load', [])).toBeNull();
  });
});

describe('isNewRecord', () => {
  it('needs to beat the earlier best: heavier, or the same load for more reps', () => {
    const before = { value: 55, reps: 5, date: '2026-11-13' };
    expect(isNewRecord('load', before, { value: 57.5, reps: 1, date: '2026-11-19' })).toBe(true);
    expect(isNewRecord('load', before, { value: 55, reps: 6, date: '2026-11-19' })).toBe(true);
    expect(isNewRecord('load', before, { value: 55, reps: 5, date: '2026-11-19' })).toBe(false);
    expect(isNewRecord('load', before, { value: 52.5, reps: 12, date: '2026-11-19' })).toBe(false);
  });

  it('a first log of an exercise is not a record: there is nothing to beat', () => {
    expect(isNewRecord('load', null, { value: 50, reps: 8, date: '2026-11-19' })).toBe(false);
  });

  it('reps records compare reps only', () => {
    expect(isNewRecord('reps', { value: 15, reps: 15, date: 'x' }, { value: 16, reps: 16, date: 'y' })).toBe(true);
    expect(isNewRecord('reps', { value: 15, reps: 15, date: 'x' }, { value: 15, reps: 15, date: 'y' })).toBe(false);
  });
});

describe('isHardSet', () => {
  it('is a set of at least one rep at effort 7 or more', () => {
    expect(isHardSet({ reps: 8, rpe: 7 })).toBe(true);
    expect(isHardSet({ reps: 8, rpe: 6 })).toBe(false);
    expect(isHardSet({ reps: 0, rpe: 10 })).toBe(false);
  });
});

describe('adherence', () => {
  it('is completed over scheduled as a whole percent, rounded down', () => {
    expect(adherence(7, 9)).toBe(77);
    expect(adherence(2, 3)).toBe(66);
    expect(adherence(3, 3)).toBe(100);
    expect(adherence(0, 4)).toBe(0);
  });
  it('is null before anything was scheduled', () => {
    expect(adherence(0, 0)).toBeNull();
  });
});
