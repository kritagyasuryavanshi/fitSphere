import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Button, buttonClass, type ButtonVariant } from './button';
import { expectNoSeriousAxeIssues } from './test-helpers';

const variants: ButtonVariant[] = ['ink', 'light', 'grey', 'volt', 'ghost', 'danger'];

describe('Button', () => {
  it.each(variants)('%s renders a pill with a focus ring', (variant) => {
    render(<Button variant={variant}>Save</Button>);
    const button = screen.getByRole('button', { name: 'Save' });
    expect(button.className).toContain('rounded-pill');
    expect(button.className).toContain('focus-visible:outline-2');
  });

  it.each([
    ['ink', 'bg-ink'],
    ['light', 'border-line-strong'],
    ['grey', 'bg-mist'],
    ['volt', 'bg-volt'],
    ['ghost', 'bg-transparent'],
    ['danger', 'bg-danger'],
  ] as const)('%s uses its own colour', (variant, cls) => {
    expect(buttonClass({ variant })).toContain(cls);
  });

  it('meets the touch target at both sizes: 48 px default, 44 px small', () => {
    expect(buttonClass()).toContain('min-h-12');
    expect(buttonClass({ size: 'small' })).toContain('min-h-11');
  });

  it('defaults to type=button so it never submits a form by accident', () => {
    render(<Button>Save</Button>);
    expect(screen.getByRole('button')).toHaveProperty('type', 'button');
  });

  it('a disabled button ignores clicks', async () => {
    const onClick = vi.fn();
    render(<Button disabled onClick={onClick}>Submit</Button>);
    await userEvent.click(screen.getByRole('button'));
    expect(onClick).not.toHaveBeenCalled();
  });

  it('buttonClass lets a link look like a button', () => {
    render(<a href="/join" className={buttonClass({ variant: 'volt' })}>Join free</a>);
    expect(screen.getByRole('link', { name: 'Join free' }).className).toContain('bg-volt');
  });

  it('has no serious axe issue', async () => {
    const { container } = render(<>{variants.map((v) => <Button key={v} variant={v}>{v}</Button>)}</>);
    await expectNoSeriousAxeIssues(container);
  });
});
