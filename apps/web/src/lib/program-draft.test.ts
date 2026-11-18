import { describe, expect, it } from 'vitest';
import { defaultPrescription, describePrescription, maxWeekUsed, move, prescriptionError, toPayload, type DraftSession } from './program-draft';

describe('describePrescription', () => {
  it('shows rounds with work and rest', () => {
    expect(describePrescription('rounds', { rounds: 3, work_s: 120, rest_s: 45 })).toBe('3 × 2 min · rest 45 s');
    expect(describePrescription('rounds', { rounds: 2, work_s: 180, rest_s: 0 })).toBe('2 × 3 min');
  });
  it('shows time in seconds or whole minutes', () => {
    expect(describePrescription('time', { seconds: 45 })).toBe('45 s');
    expect(describePrescription('time', { seconds: 600 })).toBe('10 min');
    expect(describePrescription('time', { seconds: 90 })).toBe('90 s');
  });
  it('shows sets, reps and an optional load', () => {
    expect(describePrescription('sets', { sets: 3, reps: 15, load_kg: 16 })).toBe('3 × 15 · 16 kg');
    expect(describePrescription('sets', { sets: 3, reps: 10, load_kg: null })).toBe('3 × 10');
  });
});

describe('defaultPrescription', () => {
  it('gives boxing rounds and everything else sets', () => {
    expect(defaultPrescription('boxing')).toEqual({ type: 'rounds', rounds: 3, work_s: 120, rest_s: 60 });
    expect(defaultPrescription('sc')).toEqual({ type: 'sets', sets: 3, reps: 10, load_kg: null });
    expect(defaultPrescription('gym')).toEqual({ type: 'sets', sets: 3, reps: 10, load_kg: null });
  });
});

describe('prescriptionError', () => {
  it('accepts numbers in the database ranges', () => {
    expect(prescriptionError({ type: 'rounds', rounds: 30, work_s: 10, rest_s: 0 })).toBeNull();
    expect(prescriptionError({ type: 'time', seconds: 14400 })).toBeNull();
    expect(prescriptionError({ type: 'sets', sets: 20, reps: 200, load_kg: 500 })).toBeNull();
    expect(prescriptionError({ type: 'sets', sets: 3, reps: 5, load_kg: 22.5 })).toBeNull();
  });
  it('names the first number out of range', () => {
    expect(prescriptionError({ type: 'rounds', rounds: 0, work_s: 120, rest_s: 60 })).toBe('Rounds must be 1 to 30.');
    expect(prescriptionError({ type: 'rounds', rounds: 3, work_s: 5, rest_s: 60 })).toBe('Work must be 10 to 3600 seconds.');
    expect(prescriptionError({ type: 'time', seconds: 2.5 })).toBe('Time must be 10 to 14400 seconds.');
    expect(prescriptionError({ type: 'sets', sets: 3, reps: 0, load_kg: null })).toBe('Reps must be 1 to 200.');
    expect(prescriptionError({ type: 'sets', sets: 3, reps: 8, load_kg: 501 })).toBe('Load must be 0 to 500 kg, with up to 2 decimals.');
    expect(prescriptionError({ type: 'sets', sets: 3, reps: 8, load_kg: 10.125 })).toBe('Load must be 0 to 500 kg, with up to 2 decimals.');
  });
});

describe('move', () => {
  it('moves an entry up or down and ignores moves past the ends', () => {
    expect(move(['a', 'b', 'c'], 2, -1)).toEqual(['a', 'c', 'b']);
    expect(move(['a', 'b', 'c'], 0, 1)).toEqual(['b', 'a', 'c']);
    expect(move(['a', 'b'], 0, -1)).toEqual(['a', 'b']);
    expect(move(['a', 'b'], 1, 1)).toEqual(['a', 'b']);
  });
});

const sessions: DraftSession[] = [
  {
    key: 's2',
    week: 1,
    day: 3,
    title: 'Rotational power',
    items: [{ key: 'i2', item: 'kb', title: 'Kettlebell swing', type: 'sets', sets: 3, reps: 15, load_kg: 16, rounds: 9, cue: ' Snap the hips. ' }],
  },
  {
    key: 's1',
    week: 1,
    day: 1,
    title: 'Jab & footwork',
    items: [{ key: 'i1', item: 'jab', title: 'The Jab', type: 'rounds', rounds: 3, work_s: 120, rest_s: 45, sets: 4, cue: '' }],
  },
];

describe('toPayload', () => {
  it('orders sessions by week and day and sends only the numbers each type needs', () => {
    expect(toPayload(sessions)).toEqual([
      { week: 1, day: 1, title: 'Jab & footwork', items: [{ item: 'jab', type: 'rounds', rounds: 3, work_s: 120, rest_s: 45, cue: '' }] },
      { week: 1, day: 3, title: 'Rotational power', items: [{ item: 'kb', type: 'sets', sets: 3, reps: 15, load_kg: 16, cue: 'Snap the hips.' }] },
    ]);
  });
  it('leaves out an empty load', () => {
    const [s] = toPayload([{ ...sessions[0], items: [{ ...sessions[0].items[0], load_kg: null }] }]);
    expect(s.items[0]).toEqual({ item: 'kb', type: 'sets', sets: 3, reps: 15, cue: 'Snap the hips.' });
  });
});

describe('maxWeekUsed', () => {
  it('is the latest week with a session, or 1', () => {
    expect(maxWeekUsed([])).toBe(1);
    expect(maxWeekUsed([{ ...sessions[0], week: 4 }, sessions[1]])).toBe(4);
  });
});
