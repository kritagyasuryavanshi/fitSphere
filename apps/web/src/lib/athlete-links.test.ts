import { describe, expect, it } from 'vitest';
import { athleteLinks } from './athlete-links';

describe('athlete links (M6-10)', () => {
  it('show Ask AI only when an AI provider is set', () => {
    expect(athleteLinks(true).map((l) => l.label)).toEqual(['Today', 'Learn', 'Progress', 'Coaching', 'Ask AI']);
    expect(athleteLinks(false).map((l) => l.label)).toEqual(['Today', 'Learn', 'Progress', 'Coaching']);
  });
});
