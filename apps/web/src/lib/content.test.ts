import { describe, expect, it } from 'vitest';
import { humanise, matches, parseFilters } from './content';

const jab = { discipline: 'technical', level: 'beginner', equipment: [], environments: [], drill_type: 'technical', supports: [] };
const bag = { ...jab, equipment: ['heavy_bag'], drill_type: 'conditioning' };

describe('parseFilters', () => {
  it('reads repeated and comma-separated values, and drops unknown keys and junk', () => {
    expect(parseFilters({ equipment: ['heavy_bag', 'skipping_rope'], level: 'beginner,intermediate', x: 'y', discipline: 'Bad Value!' })).toEqual({
      equipment: ['heavy_bag', 'skipping_rope'],
      level: ['beginner', 'intermediate'],
    });
  });
});

describe('matches', () => {
  it('needs one value in each chosen filter, and none means no equipment', () => {
    expect(matches(bag, { equipment: ['heavy_bag'] })).toBe(true);
    expect(matches(jab, { equipment: ['heavy_bag'] })).toBe(false);
    expect(matches(jab, { equipment: ['none'] })).toBe(true);
    expect(matches(bag, { equipment: ['heavy_bag'], drill_type: ['technical'] })).toBe(false);
    expect(matches(jab, {})).toBe(true);
  });
});

describe('humanise', () => {
  it('turns a slug into a label', () => {
    expect(humanise('heavy_bag')).toBe('Heavy bag');
  });
});
