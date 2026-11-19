import { describe, expect, it } from 'vitest';
import { paiseToRupees, rupeesToPaise } from './money';

describe('rupeesToPaise', () => {
  it('turns a typed rupee price into whole paise, exactly', () => {
    expect(rupeesToPaise('4500')).toBe(450000);
    expect(rupeesToPaise('4,500')).toBe(450000);
    expect(rupeesToPaise(' 999.99 ')).toBe(99999);
    expect(rupeesToPaise('0.1')).toBe(10);
    // 1.1 * 100 is 110.00000000000001 in floating point; the string maths never sees it.
    expect(rupeesToPaise('1.1')).toBe(110);
  });

  it('refuses what is not a price: blank, negative, three decimals, letters', () => {
    for (const bad of ['', '-5', '4500.123', '45a', '1e3', '.', '4,50,0000000']) expect(rupeesToPaise(bad), bad).toBeNull();
  });
});

describe('paiseToRupees', () => {
  it('shows paise as a rupee amount for an input field', () => {
    expect(paiseToRupees(450000)).toBe('4500');
    expect(paiseToRupees(99999)).toBe('999.99');
    expect(paiseToRupees(10)).toBe('0.10');
  });
});
