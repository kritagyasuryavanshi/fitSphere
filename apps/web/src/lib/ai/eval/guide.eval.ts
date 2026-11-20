import { describe, expect, it } from 'vitest';
import { answerQuestion, fakeModel, profileFor, type Answer, type Model } from '../answer';
import { aiModel } from '../model';
import { CASES, type EvalCase } from './cases';
import { judge } from './judge';
import { ruleFailures } from './rules';

// npm run eval:ai (from the repo root or apps/web). Runs every case 3 times. The code-checked rules must hold in all runs
// (100%). With a real model it also runs a judge on the model-written replies, whose average must be at least 90%:
//   AI_PROVIDER=gemini (GEMINI_API_KEY, free tier, no cost)   or   AI_PROVIDER=claude (ANTHROPIC_API_KEY, costs money).
// Keys come from the shell or apps/web/.env.local. With neither it runs the free fake answerer and skips the judge.
// E2E_AUTH_CONFIRM marks this as a test run, so the non-production models are allowed.
const RUNS = 3;
// The Gemini free tier allows only a few requests a minute, so it runs one at a time.
const PARALLEL = process.env.AI_PROVIDER === 'gemini' ? 1 : 4;
const real = (process.env.AI_PROVIDER === 'claude' && !!process.env.ANTHROPIC_API_KEY) || (process.env.AI_PROVIDER === 'gemini' && !!process.env.GEMINI_API_KEY);
const model: Model = (real ? aiModel({ ...process.env, E2E_AUTH_CONFIRM: '1' }) : null) ?? fakeModel;
const provider = real ? process.env.AI_PROVIDER : 'fake answerer, judge skipped';
const profile = profileFor({ sports: [{ sport: 'boxing', answers: { experience: 'new', wants: ['technique'] } }], daysPerWeek: 3, equipment: [], injuryNotes: '', healthConsent: false });
// Fixed replies (injury, unsafe, no sources) never reach the model, so the judge grades only the rest.
const reachesModel = (c: EvalCase) => c.sources.length > 0 && c.expect !== 'referral' && c.expect !== 'refused';

async function inBatches<T, R>(items: T[], size: number, f: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = [];
  for (let i = 0; i < items.length; i += size) out.push(...(await Promise.all(items.slice(i, i + size).map(f))));
  return out;
}

describe(`the AI guide eval (${CASES.length} questions x ${RUNS} runs, ${provider})`, () => {
  it('has at least 30 questions across every group', () => {
    expect(CASES.length).toBeGreaterThanOrEqual(30);
    for (const grp of ['boxing', 'sc', 'gym', 'beginner', 'injury', 'unsafe', 'off-topic', 'no-match']) expect(CASES.some((c) => c.group === grp), grp).toBe(true);
  });

  it(
    'keeps every code-checked rule in every run, and the judge average is at least 90% when it runs',
    async () => {
      const failures: string[] = [];
      const scores: number[] = [];
      let unjudged = 0;
      for (let run = 1; run <= RUNS; run++) {
        const answers: [EvalCase, Answer][] = await inBatches(CASES, PARALLEL, async (c) => [c, await answerQuestion(c.question, profile, { retrieve: async () => c.sources, model })]);
        for (const [c, a] of answers) for (const f of ruleFailures(c, a)) failures.push(`run ${run}, ${c.id}: ${f}`);
        if (real) {
          const graded = await inBatches(answers.filter(([c]) => reachesModel(c)), PARALLEL, ([c, a]) => judge(c, a));
          for (const s of graded) if (s === null) unjudged++; else scores.push(s);
        }
      }
      expect(failures, failures.join('\n')).toEqual([]);
      if (real) {
        const average = scores.reduce((x, y) => x + y, 0) / Math.max(1, scores.length);
        console.log(`judge average: ${average.toFixed(1)}% over ${scores.length} model-written replies; ${unjudged} could not be graded`);
        expect(scores.length).toBeGreaterThan(0);
        expect(average).toBeGreaterThanOrEqual(90);
      } else {
        console.log('judge skipped: set AI_PROVIDER=gemini with GEMINI_API_KEY (free) or AI_PROVIDER=claude with ANTHROPIC_API_KEY (costs money)');
      }
    },
    120 * 60_000,
  );
});
