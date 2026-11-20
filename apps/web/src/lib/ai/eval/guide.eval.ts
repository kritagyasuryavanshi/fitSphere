import { describe, expect, it } from 'vitest';
import { answerQuestion, fakeModel, profileFor, type Model } from '../answer';
import { aiModel } from '../model';
import { CASES } from './cases';
import { judge } from './judge';
import { ruleFailures } from './rules';

// npm run eval:ai. Runs every case 3 times. The code-checked rules must hold in all runs (100%). With
// AI_PROVIDER=claude and ANTHROPIC_API_KEY set (the owner's account: this costs money), it runs the real model and a
// Claude judge, whose average must be at least 90%; otherwise it runs the free fake answerer and skips the judge.
const RUNS = 3;
const real = process.env.AI_PROVIDER === 'claude' && !!process.env.ANTHROPIC_API_KEY;
const model: Model = (real ? aiModel() : null) ?? fakeModel;
const profile = profileFor({ sports: [{ sport: 'boxing', answers: { experience: 'new', wants: ['technique'] } }], daysPerWeek: 3, equipment: [], injuryNotes: '', healthConsent: false });

describe(`the AI guide eval (${CASES.length} questions x ${RUNS} runs, ${real ? 'Claude' : 'fake answerer, judge skipped'})`, () => {
  it('has at least 30 questions across every group', () => {
    expect(CASES.length).toBeGreaterThanOrEqual(30);
    for (const g of ['boxing', 'sc', 'gym', 'beginner', 'injury', 'unsafe', 'off-topic', 'no-match']) expect(CASES.some((c) => c.group === g), g).toBe(true);
  });

  it(
    'keeps every code-checked rule in every run, and the judge average is at least 90% when it runs',
    async () => {
      const failures: string[] = [];
      const scores: number[] = [];
      for (let run = 1; run <= RUNS; run++) {
        for (const c of CASES) {
          const a = await answerQuestion(c.question, profile, { retrieve: async () => c.sources, model });
          for (const f of ruleFailures(c, a)) failures.push(`run ${run}, ${c.id}: ${f}`);
          if (real) scores.push(await judge(c, a));
        }
      }
      expect(failures, failures.join('\n')).toEqual([]);
      if (real) {
        const average = scores.reduce((x, y) => x + y, 0) / scores.length;
        console.log(`judge average: ${average.toFixed(1)}%`);
        expect(average).toBeGreaterThanOrEqual(90);
      } else {
        console.log('judge skipped: set AI_PROVIDER=claude and ANTHROPIC_API_KEY to run the real model and the judge (this costs money)');
      }
    },
    30 * 60_000,
  );
});
