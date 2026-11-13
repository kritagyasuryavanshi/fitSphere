import { describe, expect, it } from 'vitest';
import { indiaToday } from './age';
import { addDays, programDay, sessionsOn } from './schedule';

describe('programDay', () => {
  it('counts the join date as week 1 day 1, and moves across a week boundary', () => {
    expect(programDay('2026-11-13', 4, '2026-11-13')).toEqual({ week: 1, day: 1 });
    expect(programDay('2026-11-13', 4, '2026-11-19')).toEqual({ week: 1, day: 7 });
    expect(programDay('2026-11-13', 4, '2026-11-20')).toEqual({ week: 2, day: 1 });
  });

  it('crosses month and year ends, and a leap day', () => {
    expect(programDay('2026-12-29', 4, '2027-01-04')).toEqual({ week: 1, day: 7 });
    expect(programDay('2028-02-27', 4, '2028-03-01')).toEqual({ week: 1, day: 4 });
  });

  it('is null before the start and after the last week', () => {
    expect(programDay('2026-11-13', 1, '2026-11-12')).toBeNull();
    expect(programDay('2026-11-13', 1, '2026-11-20')).toBeNull();
  });

  it('uses the India date for a join late at night', () => {
    // 19:00 UTC on 12 November is 00:30 on 13 November in India, so the plan starts on the 13th.
    const start = indiaToday(new Date('2026-11-12T19:00:00Z'));
    expect(start).toBe('2026-11-13');
    expect(programDay(start, 4, '2026-11-13')).toEqual({ week: 1, day: 1 });
  });
});

describe('addDays', () => {
  it('adds calendar days in ISO form', () => {
    expect(addDays('2026-11-30', 1)).toBe('2026-12-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });
});

describe('sessionsOn', () => {
  it('merges several programs into one day list, in program order then session order', () => {
    const plans = [
      { id: 'boxing', startDate: '2026-11-13', weeks: 4, sessions: [{ week: 1, day: 2, position: 2, title: 'Pads' }, { week: 1, day: 2, position: 1, title: 'Jab' }, { week: 1, day: 3, position: 1, title: 'Rest' }] },
      { id: 'sc', startDate: '2026-11-14', weeks: 4, sessions: [{ week: 1, day: 1, position: 1, title: 'Power' }] },
    ];
    expect(sessionsOn(plans, '2026-11-14').map((s) => `${s.programId}:${s.title}`)).toEqual(['boxing:Jab', 'boxing:Pads', 'sc:Power']);
    expect(sessionsOn(plans, '2026-11-12')).toEqual([]);
  });
});
