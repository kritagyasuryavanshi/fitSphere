import { describe, expect, it } from 'vitest';
import { renewalState } from './renewal';

// Decision 1: the athlete pays the next month from 5 days before the paid date to 3 days after it.
describe('renewalState', () => {
  const today = '2026-12-10';
  it('is not open more than 5 days before the paid date', () => expect(renewalState('2026-12-16', today, false)).toBe('later'));
  it('is due from 5 days before up to the paid date', () => {
    expect(renewalState('2026-12-15', today, false)).toBe('due');
    expect(renewalState('2026-12-10', today, false)).toBe('due');
  });
  it('is in grace for 3 days after the paid date, then closed', () => {
    expect(renewalState('2026-12-07', today, false)).toBe('grace');
    expect(renewalState('2026-12-06', today, false)).toBe(null);
  });
  it('never applies to coaching that renews by subscription', () => expect(renewalState('2026-12-12', today, true)).toBe(null));
});
