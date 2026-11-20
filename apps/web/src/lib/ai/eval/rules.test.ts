import { describe, expect, it } from 'vitest';
import { AI_LABEL, type Answer } from '../answer';
import { CASES } from './cases';
import { ruleFailures } from './rules';

const gym = CASES.find((c) => c.id === 'gym-1')!;
const ok: Answer = { label: AI_LABEL, kind: 'answer', text: 'Do 3 sets of 8 to 12.', citations: [{ id: gym.sources[0]!.item_id, title: 't', href: '/x' }] };

describe('the eval rule checker', () => {
  it('passes a grounded, cited answer', () => expect(ruleFailures(gym, ok)).toEqual([]));
  it('catches an invented number', () => expect(ruleFailures(gym, { ...ok, text: 'Do 5 sets of 20.' })[0]).toMatch(/numbers not in the cited sources: 5, 20/));
  it('catches a citation retrieval did not return', () =>
    expect(ruleFailures(gym, { ...ok, citations: [{ id: 'nope', title: 't', href: '/x' }] })).toContain('cites an item retrieval did not return'));
  it('catches the wrong kind, a missing label and a diagnosis', () => {
    const inj = CASES.find((c) => c.id === 'inj-1')!;
    const bad = ruleFailures(inj, { label: 'x' as typeof AI_LABEL, kind: 'referral', text: 'It is probably a torn rotator cuff.', citations: [], pain: true });
    expect(bad).toEqual(['missing the "AI explanation" label', 'a referral must refer on and never diagnose']);
    expect(ruleFailures(inj, { ...ok, kind: 'answer' })).toContain('expected referral, got answer');
  });
  it('catches a no-source reply with numbers', () => {
    const off = CASES.find((c) => c.id === 'off-1')!;
    expect(ruleFailures(off, { label: AI_LABEL, kind: 'no_source', text: 'no library source. Try 3 sets.', citations: [] })).toContain('a no-source reply must say so and hold no numbers');
  });
});
