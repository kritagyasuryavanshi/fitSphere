import { describe, expect, it } from 'vitest';
import { nextTarget } from './progression';

describe('nextTarget', () => {
  it('adds 2.5 kg when every set hit the top of the rep range', () => {
    expect(nextTarget(8, 3, [{ reps: 8, loadKg: 50 }, { reps: 8, loadKg: 50 }, { reps: 9, loadKg: 50 }])).toEqual({ loadKg: 52.5, change: 'increase' });
  });

  it('keeps the weight when any set fell short', () => {
    expect(nextTarget(8, 1, [{ reps: 8, loadKg: 50 }, { reps: 8, loadKg: 50 }, { reps: 7, loadKg: 50 }])).toEqual({ loadKg: 50, change: 'keep' });
  });

  it('counts from the heaviest load used', () => {
    expect(nextTarget(10, 1, [{ reps: 10, loadKg: 20 }, { reps: 10, loadKg: 22.5 }])).toEqual({ loadKg: 25, change: 'increase' });
    expect(nextTarget(10, 1, [{ reps: 10, loadKg: 22.5 }, { reps: 6, loadKg: 20 }])).toEqual({ loadKg: 22.5, change: 'keep' });
  });

  it('adds exactly, without floating point drift', () => {
    expect(nextTarget(5, 1, [{ reps: 5, loadKg: 0.1 + 0.2 }])?.loadKg).toBe(2.8);
    expect(nextTarget(5, 1, [{ reps: 5, loadKg: 47.5 }])?.loadKg).toBe(50);
  });

  it('keeps the weight when fewer sets were done than planned, even if each hit the top', () => {
    expect(nextTarget(8, 3, [{ reps: 8, loadKg: 50 }])).toEqual({ loadKg: 50, change: 'keep' });
    expect(nextTarget(8, 3, [{ reps: 8, loadKg: 50 }, { reps: 8, loadKg: 50 }, { reps: 8, loadKg: 50 }, { reps: 8, loadKg: 50 }])).toEqual({ loadKg: 52.5, change: 'increase' });
  });

  it('suggests nothing for bodyweight work, or without sets', () => {
    expect(nextTarget(10, 1, [{ reps: 10, loadKg: null }])).toBeNull();
    expect(nextTarget(10, 1, [])).toBeNull();
  });

  it('ignores bodyweight sets when some sets had a load', () => {
    expect(nextTarget(8, 1, [{ reps: 8, loadKg: 40 }, { reps: 8, loadKg: null }])).toEqual({ loadKg: 42.5, change: 'increase' });
  });
});
