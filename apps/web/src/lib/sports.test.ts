import { describe, expect, it } from 'vitest';
import { firstSport, progressView } from './sports';

const live = [{ id: 'boxing' }, { id: 'sc' }, { id: 'gym' }];

describe('firstSport', () => {
  it('picks the first chosen sport in library order', () => {
    expect(firstSport(['gym', 'sc'], live)).toBe('sc');
    expect(firstSport(['gym'], live)).toBe('gym');
  });
  it('never assumes boxing when nothing live is chosen', () => {
    expect(firstSport([], live)).toBeNull();
    expect(firstSport(['cricket'], live)).toBeNull();
  });
});

describe('progressView', () => {
  it('opens on gym for an athlete who trains only in the gym', () => {
    expect(progressView(['gym'])).toBe('gym');
  });
  it('opens on the training view when boxing or S&C is chosen, or nothing is', () => {
    expect(progressView(['gym', 'sc'])).toBe('training');
    expect(progressView(['boxing'])).toBe('training');
    expect(progressView([])).toBe('training');
  });
});
