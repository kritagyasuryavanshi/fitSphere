import { describe, expect, it } from 'vitest';
import { CONTENT_GATE, gateFailures } from './content-gate';

describe('content gate (M6-13)', () => {
  it('needs 20 boxing skills and 30 S&C drills or exercises', () => {
    expect(CONTENT_GATE).toEqual({ boxingSkills: 20, scItems: 30 });
  });

  it('passes at exactly the minimums', () => {
    expect(gateFailures({ boxingSkills: 20, scItems: 30 })).toEqual([]);
  });

  it('names each shortfall', () => {
    expect(gateFailures({ boxingSkills: 19, scItems: 3 })).toEqual(['boxing skills: 19 of 20', 'S&C drills and exercises: 3 of 30']);
  });
});
