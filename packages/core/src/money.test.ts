import { describe, expect, it } from 'vitest';
import { formatInr } from './money';

describe('formatInr', () => {
  it('shows whole rupees without decimals', () => {
    expect(formatInr(450000)).toBe('₹4,500');
  });

  it('uses Indian digit grouping', () => {
    expect(formatInr(12345600)).toBe('₹1,23,456');
  });

  it('shows paise when the amount is not a whole rupee', () => {
    expect(formatInr(120050)).toBe('₹1,200.50');
  });

  it('shows zero', () => {
    expect(formatInr(0)).toBe('₹0');
  });

  it('rejects fractions of a paisa', () => {
    expect(() => formatInr(12.5)).toThrow('whole number of paise');
  });
});
