import { describe, expect, it } from 'vitest';
import { indiaToday, isAdult, parseDob } from './age';

describe('parseDob', () => {
  it('builds an ISO date from day, month and year fields', () => {
    expect(parseDob(' 12', '6', '1998 ')).toBe('1998-06-12');
  });

  it.each([
    ['31', '04', '1998'],
    ['29', '02', '2001'],
    ['0', '01', '1998'],
    ['12', '13', '1998'],
    ['12', '06', '98'],
    ['12', '06', '1899'],
    ['x', '06', '1998'],
    ['', '', ''],
  ])('rejects %s/%s/%s', (d, m, y) => {
    expect(parseDob(d, m, y)).toBeNull();
  });

  it('accepts 29 February in a leap year', () => {
    expect(parseDob('29', '02', '2004')).toBe('2004-02-29');
  });
});

describe('indiaToday', () => {
  it('uses the date in India, not UTC', () => {
    // 20:00 UTC on 11 November is 01:30 on 12 November in India.
    expect(indiaToday(new Date('2026-11-11T20:00:00Z'))).toBe('2026-11-12');
  });
});

describe('isAdult', () => {
  it('is 18 on the 18th birthday, not the day before', () => {
    expect(isAdult('2008-11-22', '2026-11-22')).toBe(true);
    expect(isAdult('2008-11-23', '2026-11-22')).toBe(false);
  });
  it('turns a 29 February birthday 18 on 1 March in a common year', () => {
    expect(isAdult('2008-02-29', '2026-02-28')).toBe(false);
    expect(isAdult('2008-02-29', '2026-03-01')).toBe(true);
  });
  it('treats older people as adults', () => {
    expect(isAdult('1998-06-12', '2026-11-22')).toBe(true);
  });
});
