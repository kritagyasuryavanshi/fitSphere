import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Button } from './button';
import { Dialog } from './dialog';
import { expectNoSeriousAxeIssues } from './test-helpers';

const dialog = (props: { open: boolean; onClose?: () => void; alert?: boolean }) => (
  <Dialog
    open={props.open}
    onClose={props.onClose ?? (() => undefined)}
    alert={props.alert}
    title="Delete your account?"
    description="You cannot undo this."
    actions={<Button variant="danger">Delete my account</Button>}
  />
);

describe('Dialog', () => {
  it('is closed until asked to open', () => {
    render(dialog({ open: false }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('opens with its title and description wired up', () => {
    render(dialog({ open: true }));
    const el = screen.getByRole('dialog', { name: 'Delete your account?' });
    const describedBy = el.getAttribute('aria-describedby');
    expect(document.getElementById(describedBy as string)?.textContent).toBe('You cannot undo this.');
  });

  it('a destructive confirm is an alertdialog', () => {
    render(dialog({ open: true, alert: true }));
    expect(screen.getByRole('alertdialog', { name: 'Delete your account?' })).toBeTruthy();
  });

  it('a confirm does not put focus on the destructive button', () => {
    render(dialog({ open: true, alert: true }));
    expect(document.activeElement).toBe(screen.getByRole('alertdialog'));
  });

  it('closes when the parent says so', () => {
    const { rerender } = render(dialog({ open: true }));
    rerender(dialog({ open: false }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('reports Escape (the native cancel event) to the parent, which stays in charge', () => {
    const onClose = vi.fn();
    render(dialog({ open: true, onClose }));
    const el = screen.getByRole('dialog');
    const notPrevented = fireEvent(el, new Event('cancel', { cancelable: true }));
    expect(onClose).toHaveBeenCalledOnce();
    expect(notPrevented).toBe(false);
  });

  it('has no serious axe issue', async () => {
    const { container } = render(dialog({ open: true }));
    await expectNoSeriousAxeIssues(container);
  });
});
