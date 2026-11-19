import { describe, expect, it } from 'vitest';
import { firstOpen, isIsoDate, playable, timerPlan } from './session-player';

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
  it('plays a session of rounds and timed drills only', () => {
    expect(playable([{ type: 'rounds' }, { type: 'time' }])).toBe(true);
    expect(playable([{ type: 'rounds' }, { type: 'sets' }])).toBe(false);
    expect(playable([])).toBe(false);
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
