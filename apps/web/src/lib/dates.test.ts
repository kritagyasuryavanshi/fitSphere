import { describe, expect, it } from 'vitest';
import { shortDate } from './dates';

describe('shortDate', () => {
  it('writes an India date as day and month, and can add days', () => {
    expect(shortDate('2026-12-15')).toBe('15 Dec');
    expect(shortDate('2026-12-31', 1)).toBe('1 Jan');
  });
});
