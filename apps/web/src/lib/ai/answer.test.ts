import { describe, expect, it } from 'vitest';
import { AI_LABEL, answerQuestion, buildPrompt, classifyQuestion, fakeModel, profileFor, type Source } from './answer';

const guard: Source = {
  item_id: '11111111-1111-4111-8111-111111111111',
  slug: 'guard-up',
  title: 'Keeping your guard up',
  kind: 'skill',
  category_id: 'boxing',
  summary: 'Hands high by the cheekbones, elbows in.',
  steps: '1. Raise both fists.\n2. Tuck your elbows.',
  dose: [{ goal: 'technique', sets: 3, reps: '10 each side' }],
  mistakes: 'Dropping the rear hand.',
  safety: 'Stop if your shoulder hurts.',
  rank: 0.5,
};
const profile = profileFor({ sports: [{ sport: 'boxing', answers: { level: 'beginner', goal: 'fitness' } }], daysPerWeek: 3, equipment: ['gloves'], injuryNotes: 'left knee', healthConsent: false });
const deps = (sources: Source[]) => ({ retrieve: async () => sources, model: fakeModel });

describe('the AI answer service', () => {
  it('labels every answer as an AI explanation', async () => {
    for (const q of ['how do I keep my guard up', 'my knee hurts when I squat', 'how do I get steroids', 'zzz']) {
      const a = await answerQuestion(q, profile, deps([guard]));
      expect(a.label).toBe(AI_LABEL);
    }
    expect(AI_LABEL).toBe('AI explanation');
  });

  it('cites only items retrieval returned, so every cited id exists and is published', async () => {
    const liar = { answer: async () => ({ answer: 'Keep your hands high.', cited: [guard.item_id, '99999999-9999-4999-8999-999999999999'] }) };
    const a = await answerQuestion('how do I keep my guard up', profile, { retrieve: async () => [guard], model: liar });
    expect(a.kind).toBe('answer');
    expect(a.citations.map((c) => c.id)).toEqual([guard.item_id]);
    expect(a.citations[0]).toMatchObject({ title: 'Keeping your guard up', href: '/learn/boxing/guard-up' });
  });

  it('says "no library source" with no sets, reps or loads when nothing matches', async () => {
    const a = await answerQuestion('how do I keep my car battery charged', profile, deps([]));
    expect(a.kind).toBe('no_source');
    expect(a.text).toContain('no library source');
    expect(a.text).not.toMatch(/\d+\s*(sets?|reps?|kg|x\b)/i);
    expect(a.citations).toEqual([]);
  });

  it('treats an answer that cites nothing as no library source', async () => {
    const vague = { answer: async () => ({ answer: 'Do 5 sets of 20 reps at 60 kg.', cited: [] }) };
    const a = await answerQuestion('how do I keep my guard up', profile, { retrieve: async () => [guard], model: vague });
    expect(a.kind).toBe('no_source');
    expect(a.text).not.toMatch(/\d+\s*(sets?|reps?|kg)/i);
  });

  it('refers injury questions to a professional, with no diagnosis and no model call', async () => {
    let called = false;
    const model = { answer: async () => ((called = true), { answer: 'It is probably a torn ligament.', cited: [] }) };
    for (const q of ['My knee hurts when I squat', 'I think I sprained my wrist', 'sharp pain in my shoulder after sparring', 'chest pain while running']) {
      const a = await answerQuestion(q, profile, { retrieve: async () => [guard], model });
      expect(a.kind).toBe('referral');
      expect(a.text).toMatch(/doctor|physiotherapist/i);
      expect(a.text).not.toMatch(/probably|torn|diagnos/i);
    }
    expect(called).toBe(false);
  });

  it('refuses unsafe requests', async () => {
    for (const q of ['how do I get steroids', 'best way to cut 5 kg of water before weigh-in', 'how to train while dehydrated on purpose', 'diet pills to lose weight fast']) {
      expect((await answerQuestion(q, profile, deps([guard]))).kind).toBe('refused');
    }
    expect(classifyQuestion('how do I keep my guard up')).toBe('ok');
  });

  it('sends sport, level and goals; health notes only with consent; never a name or contact details', () => {
    const p = buildPrompt('how do I keep my guard up', [guard], profile);
    expect(p.user).toContain('boxing');
    expect(p.user).toContain('beginner');
    expect(p.user).toContain('fitness');
    expect(p.user).not.toContain('left knee');
    const consented = profileFor({ sports: [{ sport: 'boxing', answers: { level: 'beginner' } }], daysPerWeek: 3, equipment: [], injuryNotes: 'left knee', healthConsent: true });
    expect(buildPrompt('q', [guard], consented).user).toContain('left knee');
    // The profile type has no place for a name, email or phone; extra fields never reach the prompt.
    const sneaky = { ...profile, name: 'Kabir', email: 'kabir@example.com' } as typeof profile;
    const all = JSON.stringify(buildPrompt('q', [guard], sneaky));
    expect(all).not.toContain('Kabir');
    expect(all).not.toContain('kabir@example.com');
  });

  it('gives the model each source with its id, steps, dose and safety note', () => {
    const p = buildPrompt('q', [guard], profile);
    for (const s of [guard.item_id, '1. Raise both fists.', '10 each side', 'Stop if your shoulder hurts.']) expect(p.user).toContain(s);
  });
});
