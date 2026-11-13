import { describe, expect, it } from 'vitest';
import { pathOrder, skillStatus } from './skill-path';

describe('pathOrder', () => {
  it('puts every skill after its prerequisites, keeping the given order otherwise', () => {
    const skills = ['cross', 'jab', 'stance', 'guard', 'hook'];
    const links = [
      ['guard', 'stance'],
      ['jab', 'guard'],
      ['cross', 'jab'],
      ['hook', 'cross'],
    ] as [string, string][];
    expect(pathOrder(skills, links)).toEqual(['stance', 'guard', 'jab', 'cross', 'hook']);
  });

  it('ignores links to skills outside the path and survives a cycle', () => {
    expect(pathOrder(['a', 'b'], [['a', 'x'], ['a', 'b'], ['b', 'a']])).toEqual(['a', 'b']);
  });
});

describe('skillStatus', () => {
  it('is done when completed, in progress when saved, otherwise not started', () => {
    const completed = new Set(['stance']);
    const saved = new Set(['jab', 'stance']);
    expect(skillStatus('stance', completed, saved)).toBe('done');
    expect(skillStatus('jab', completed, saved)).toBe('in_progress');
    expect(skillStatus('cross', completed, saved)).toBe('not_started');
  });
});
