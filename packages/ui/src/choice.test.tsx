import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { Checkbox, RadioCard } from './choice';
import { expectNoSeriousAxeIssues } from './test-helpers';

describe('Checkbox', () => {
  it('toggles when the label is clicked', async () => {
    render(<Checkbox label="Technical boxing" />);
    const box = screen.getByRole('checkbox', { name: 'Technical boxing' });
    await userEvent.click(screen.getByText('Technical boxing'));
    expect(box).toHaveProperty('checked', true);
  });

  it('the whole label is a 44 px touch target', () => {
    render(<Checkbox label="Bag work" />);
    expect(screen.getByText('Bag work').closest('label')?.className).toContain('min-h-11');
  });

  it('has a visible focus ring', () => {
    render(<Checkbox label="Bag work" />);
    expect(screen.getByRole('checkbox').className).toContain('focus-visible:outline-2');
  });
});

describe('RadioCard', () => {
  const group = (
    <fieldset>
      <legend>Goal</legend>
      <RadioCard name="goal" value="muscle" label="Build muscle" description="Hypertrophy" />
      <RadioCard name="goal" value="fat" label="Lose fat" />
    </fieldset>
  );

  it('selects one option in a group', async () => {
    render(group);
    await userEvent.click(screen.getByText('Build muscle'));
    await userEvent.click(screen.getByText('Lose fat'));
    expect(screen.getByRole('radio', { name: /Build muscle/ })).toHaveProperty('checked', false);
    expect(screen.getByRole('radio', { name: 'Lose fat' })).toHaveProperty('checked', true);
  });

  it('shows the description, is a tall target, and marks the chosen card', () => {
    render(group);
    expect(screen.getByText('Hypertrophy')).toBeTruthy();
    const card = screen.getByText('Lose fat').closest('label');
    expect(card?.className).toContain('min-h-11');
    expect(card?.className).toContain('has-checked:border-ink');
  });

  it('a disabled card is dashed and cannot be chosen', async () => {
    render(<RadioCard name="sport" value="cricket" label="Cricket" disabled />);
    await userEvent.click(screen.getByText('Cricket'));
    expect(screen.getByRole('radio')).toHaveProperty('checked', false);
    expect(screen.getByText('Cricket').closest('label')?.className).toContain('border-dashed');
  });

  it('has no serious axe issue', async () => {
    const { container } = render(<>{group}<Checkbox label="Bag work" /></>);
    await expectNoSeriousAxeIssues(container);
  });
});
