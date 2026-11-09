import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Input } from './input';
import { expectNoSeriousAxeIssues } from './test-helpers';

describe('Input', () => {
  it('is named by its label and is 48 px tall', () => {
    render(<Input label="Email" type="email" />);
    expect(screen.getByLabelText('Email').className).toContain('min-h-12');
  });

  it('has no error state by default', () => {
    render(<Input label="Email" />);
    const input = screen.getByLabelText('Email');
    expect(input.getAttribute('aria-invalid')).toBeNull();
    expect(input.getAttribute('aria-describedby')).toBeNull();
  });

  it('shows the error inline and links it to the field', () => {
    render(<Input label="Email" error="Enter a full email address" />);
    const input = screen.getByRole('textbox', { name: 'Email' });
    expect(input.getAttribute('aria-invalid')).toBe('true');
    const errorId = input.getAttribute('aria-describedby');
    expect(errorId).toBeTruthy();
    expect(document.getElementById(errorId as string)?.textContent).toContain('Enter a full email address');
    expect(input.className).toContain('border-danger');
  });

  it('keeps a caller-supplied description alongside the error', () => {
    render(<Input label="Email" aria-describedby="hint" error="Bad email" />);
    expect(screen.getByRole('textbox').getAttribute('aria-describedby')).toMatch(/^hint \S+$/);
  });

  it('has no serious axe issue, with or without an error', async () => {
    const { container } = render(<><Input label="Name" /><Input label="Email" error="Bad email" /></>);
    await expectNoSeriousAxeIssues(container);
  });
});
