import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Tag } from './tag';

describe('Tag', () => {
  it.each([
    ['outline', 'border-line-strong'],
    ['ink', 'bg-ink'],
    ['volt', 'bg-volt'],
    ['success', 'bg-success-soft'],
    ['warning', 'bg-warning-soft'],
    ['danger', 'bg-danger-soft'],
  ] as const)('%s uses its own colour', (variant, cls) => {
    render(<Tag variant={variant}>Sample</Tag>);
    expect(screen.getByText('Sample').className).toContain(cls);
  });

  it('defaults to outline', () => {
    render(<Tag>Beginner</Tag>);
    expect(screen.getByText('Beginner').className).toContain('border-line-strong');
  });
});
