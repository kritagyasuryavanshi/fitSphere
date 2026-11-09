import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const css = readFileSync(join(import.meta.dirname, 'tokens.css'), 'utf8');
const token = (name: string) => css.match(new RegExp(`--${name}:\\s*([^;]+);`))?.[1]?.trim().toLowerCase();

describe('Fight Camp tokens match the mockups', () => {
  it.each([
    ['color-ink', '#111111'],
    ['color-ink-soft', '#39393b'],
    ['color-paper', '#ffffff'],
    ['color-mist', '#f5f5f5'],
    ['color-line', '#e5e5e5'],
    ['color-line-strong', '#cacacb'],
    ['color-muted', '#707072'],
    ['color-faint', '#9e9ea0'],
    ['color-volt', '#d4f000'],
    ['color-success', '#00653a'],
    ['color-success-soft', '#e3f4ec'],
    ['color-warning', '#8a4600'],
    ['color-warning-soft', '#fff1e0'],
    ['color-danger', '#a3001a'],
    ['color-danger-soft', '#fde8eb'],
    ['radius-pill', '30px'],
  ])('%s is %s', (name, value) => {
    expect(token(name)).toBe(value);
  });

  it('uses Anton for display and Inter for body, with fallbacks', () => {
    expect(token('font-display')).toContain('--font-anton');
    expect(token('font-display')).toContain('impact');
    expect(token('font-body')).toContain('--font-inter');
    expect(token('font-body')).toContain('helvetica');
  });
});
