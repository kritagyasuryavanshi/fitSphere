import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Tabs } from './tabs';
import { expectNoSeriousAxeIssues } from './test-helpers';

const tabs = [
  { id: 'w1', label: 'Week 1', content: <p>First week</p> },
  { id: 'w2', label: 'Week 2', content: <p>Second week</p> },
  { id: 'w3', label: 'Week 3', content: <p>Third week</p> },
];
const selected = () => screen.getByRole('tab', { selected: true }).textContent;

describe('Tabs', () => {
  it('shows the first tab by default and only its panel', () => {
    render(<Tabs label="Weeks" tabs={tabs} />);
    expect(selected()).toBe('Week 1');
    expect(screen.getByRole('tabpanel').textContent).toBe('First week');
    expect(screen.queryByText('Second week')).toBeNull();
  });

  it('honours defaultTab', () => {
    render(<Tabs label="Weeks" tabs={tabs} defaultTab="w2" />);
    expect(selected()).toBe('Week 2');
  });

  it('switches on click and reports the change', async () => {
    const onChange = vi.fn();
    render(<Tabs label="Weeks" tabs={tabs} onChange={onChange} />);
    await userEvent.click(screen.getByRole('tab', { name: 'Week 3' }));
    expect(screen.getByRole('tabpanel').textContent).toBe('Third week');
    expect(onChange).toHaveBeenCalledWith('w3');
  });

  it('arrow keys move and wrap; Home and End jump; focus follows', async () => {
    render(<Tabs label="Weeks" tabs={tabs} />);
    await userEvent.tab();
    expect(document.activeElement?.textContent).toBe('Week 1');
    await userEvent.keyboard('{ArrowRight}');
    expect(selected()).toBe('Week 2');
    expect(document.activeElement?.textContent).toBe('Week 2');
    await userEvent.keyboard('{End}');
    expect(selected()).toBe('Week 3');
    await userEvent.keyboard('{ArrowRight}');
    expect(selected()).toBe('Week 1');
    await userEvent.keyboard('{ArrowLeft}');
    expect(selected()).toBe('Week 3');
    await userEvent.keyboard('{Home}');
    expect(selected()).toBe('Week 1');
  });

  it('only the selected tab is in the tab order', () => {
    render(<Tabs label="Weeks" tabs={tabs} />);
    const order = screen.getAllByRole('tab').map((t) => t.getAttribute('tabindex'));
    expect(order).toEqual(['0', '-1', '-1']);
  });

  it('tabs are 44 px targets with a focus ring', () => {
    render(<Tabs label="Weeks" tabs={tabs} />);
    const cls = screen.getByRole('tab', { name: 'Week 1' }).className;
    expect(cls).toContain('min-h-11');
    expect(cls).toContain('focus-visible:outline-2');
  });

  it('has no serious axe issue', async () => {
    const { container } = render(<Tabs label="Weeks" tabs={tabs} />);
    await expectNoSeriousAxeIssues(container);
  });
});
