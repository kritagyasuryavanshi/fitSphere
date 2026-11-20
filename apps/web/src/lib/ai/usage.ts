import { AI_LABEL, type Answer } from './answer';

export type Usage = { input_tokens: number; output_tokens: number; provider?: 'claude' | 'gemini' };

// Claude Opus 5.5 list prices: $4 per million input tokens, $20 per million output tokens, so 4 and 20 millionths of a
// dollar per token. shortcut: list price only; caching, fallbacks to another model, and tax are not priced in.
const IN_MICRO_USD = 4;
const OUT_MICRO_USD = 20;

/** What one question cost, in millionths of a US dollar. The fake answerer, fixed answers and Gemini's free tier cost nothing. */
export function costMicroUsd(usage: Usage | undefined): number {
  if (!usage || usage.provider === 'gemini') return 0;
  return Math.max(0, usage.input_tokens) * IN_MICRO_USD + Math.max(0, usage.output_tokens) * OUT_MICRO_USD;
}

/** The reply for the question past the day's limit. */
export function limitAnswer(limit: number): Answer {
  return { label: AI_LABEL, kind: 'limit', text: `You have asked ${limit} questions today, the daily limit. Ask again tomorrow.`, citations: [] };
}

/** A clear reply for a question the database refused to take, or null for a real error. */
export function reservationRefusal(message: string, limit: number): Answer | null {
  if (message.includes('ai_daily_limit')) return limitAnswer(limit);
  if (message.includes('bad_question')) return { label: AI_LABEL, kind: 'refused', text: 'Type a question of up to 500 characters.', citations: [] };
  if (message.includes('not_athlete')) return { label: AI_LABEL, kind: 'refused', text: 'The training guide is for athletes. Add the athlete role in your account.', citations: [] };
  return null;
}
