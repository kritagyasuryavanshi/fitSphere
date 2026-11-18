import { describe, expect, it } from 'vitest';
import { indiaToday } from './age';
import { addDays, calendarWeek, programDay, sessionsOn, versionOn } from './schedule';

describe('versionOn', () => {
  const versions = [
    { id: 'v1', version: 1, effectiveFrom: '2026-11-10' },
    { id: 'v3', version: 3, effectiveFrom: '2026-11-20' },
    { id: 'v2', version: 2, effectiveFrom: '2026-11-15' },
  ];
  it('picks the newest version whose first day has come, as version_in_effect does', () => {
    expect(versionOn(versions, '2026-11-14')?.id).toBe('v1');
    expect(versionOn(versions, '2026-11-15')?.id).toBe('v2');
    expect(versionOn(versions, '2026-11-19')?.id).toBe('v2');
    expect(versionOn(versions, '2026-11-20')?.id).toBe('v3');
  });
  it('falls back to the earliest before any has started, and breaks a same-day tie by version', () => {
    expect(versionOn(versions, '2026-11-01')?.id).toBe('v1');
    expect(versionOn([...versions, { id: 'v4', version: 4, effectiveFrom: '2026-11-20' }], '2026-11-21')?.id).toBe('v4');
    expect(versionOn([], '2026-11-21')).toBeUndefined();
  });
});

describe('calendarWeek', () => {
  it('gives Monday to Sunday around a date, with weekday names', () => {
    // 2026-11-19 is a Thursday.
    const week = calendarWeek('2026-11-19');
    expect(week.map((d) => d.date)).toEqual(['2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19', '2026-11-20', '2026-11-21', '2026-11-22']);
    expect(week.map((d) => d.name)).toEqual(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);
  });
  it('starts on the date itself on a Monday, and ends on it on a Sunday, across a month end', () => {
    expect(calendarWeek('2026-11-30')[0]?.date).toBe('2026-11-30');
    expect(calendarWeek('2026-11-29').map((d) => d.date)).toEqual(['2026-11-23', '2026-11-24', '2026-11-25', '2026-11-26', '2026-11-27', '2026-11-28', '2026-11-29']);
  });
});

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
