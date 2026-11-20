import { describe, expect, it } from 'vitest';
import { AI_LABEL } from './answer';
import { costMicroUsd, limitAnswer, reservationRefusal } from './usage';

describe('the AI usage log and the daily limit', () => {
  it('prices a question at Claude Opus 5.5 list rates ($4 in, $20 out per million tokens), in millionths of a dollar', () => {
    expect(costMicroUsd({ input_tokens: 1000, output_tokens: 100, provider: 'claude' })).toBe(6000);
    expect(costMicroUsd({ input_tokens: 0, output_tokens: 0, provider: 'claude' })).toBe(0);
    expect(costMicroUsd(undefined)).toBe(0);
  });

  it('logs the Gemini free tier as costing nothing', () => {
    expect(costMicroUsd({ input_tokens: 5000, output_tokens: 900, provider: 'gemini' })).toBe(0);
  });

  it('blocks the 11th question of the day with a clear message', () => {
    const blocked = reservationRefusal('ai_daily_limit', 10);
    expect(blocked).toEqual(limitAnswer(10));
    expect(blocked!.label).toBe(AI_LABEL);
    expect(blocked!.kind).toBe('limit');
    expect(blocked!.text).toBe('You have asked 10 questions today, the daily limit. Ask again tomorrow.');
    expect(blocked!.citations).toEqual([]);
  });

  it('turns other refusals into plain messages, and leaves real errors to throw', () => {
    expect(reservationRefusal('bad_question', 10)!.text).toBe('Type a question of up to 500 characters.');
    expect(reservationRefusal('not_athlete', 10)!.kind).toBe('refused');
    expect(reservationRefusal('connection reset', 10)).toBeNull();
  });
});
