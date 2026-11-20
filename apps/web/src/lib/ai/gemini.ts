import { z } from 'zod';
import type { Model } from './answer';

// Google Gemini through its REST API (no SDK). shortcut: the free tier, for local test runs and the eval only: Google may
// use free-tier prompts and replies to improve its products, so real athlete data never goes here (model.ts allows it on
// a local test run only, never on a Vercel deploy, previews included, which share the production database). A paid
// Gemini plan or Claude is the choice for real users.
const MODEL = 'gemini-3.8-flash';
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

type Part = { text?: string; thought?: boolean };
type Body = {
  candidates?: { content?: { parts?: Part[] }; finishReason?: string }[];
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; thoughtsTokenCount?: number };
};

/**
 * One structured call: a system instruction, one user turn, and a JSON schema the reply must follow. Returns the reply
 * text (thinking parts left out), whether the model finished normally, and the tokens used. The key goes in a header,
 * never the URL, so it stays out of logs.
 */
export async function geminiJson(apiKey: string, system: string, user: string, schema: object) {
  // Three tries in all, 20 s then 40 s apart: the free tier allows a few requests a minute (429), and a busy service
  // answers 5xx or times out. Anything else is final at once. Each try times out after 60 s.
  let last: unknown = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt) await new Promise((r) => setTimeout(r, 20_000 * attempt));
    try {
      const res = await send(apiKey, system, user, schema);
      if (res.status === 429 || res.status >= 500) {
        last = new Error(`Gemini ${res.status}`);
        continue;
      }
      return await read(res);
    } catch (e) {
      if (!(e instanceof Error) || (e.name !== 'TimeoutError' && e.name !== 'AbortError' && e.name !== 'TypeError')) throw e;
      last = e;
    }
  }
  throw last instanceof Error ? last : new Error('Gemini unavailable');
}

function send(apiKey: string, system: string, user: string, schema: object) {
  return fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'x-goog-api-key': apiKey, 'content-type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: 'user', parts: [{ text: user }] }],
      generationConfig: { responseMimeType: 'application/json', responseJsonSchema: schema },
    }),
    signal: AbortSignal.timeout(60_000),
  });
}

async function read(res: Response) {
  if (!res.ok) throw new Error(`Gemini ${res.status}`);
  const body = (await res.json()) as Body;
  const c = body.candidates?.[0];
  const text = (c?.content?.parts ?? []).filter((p) => !p.thought && typeof p.text === 'string').map((p) => p.text).join('');
  const u = body.usageMetadata ?? {};
  return {
    text,
    finished: c?.finishReason === 'STOP',
    usage: { input_tokens: u.promptTokenCount ?? 0, output_tokens: (u.candidatesTokenCount ?? 0) + (u.thoughtsTokenCount ?? 0), provider: 'gemini' as const },
  };
}

const Reply = z.object({ answer: z.string(), cited: z.array(z.string()), needs_referral: z.boolean() });
const SCHEMA = {
  type: 'object',
  properties: { answer: { type: 'string' }, cited: { type: 'array', items: { type: 'string' } }, needs_referral: { type: 'boolean' } },
  required: ['answer', 'cited', 'needs_referral'],
};

/** The answer model on Gemini. A reply cut short, or one that breaks the schema, comes back unavailable with its usage. */
export function geminiModel(apiKey: string): Model {
  return {
    async answer({ system, user }) {
      const r = await geminiJson(apiKey, system, user, SCHEMA);
      const unavailable = { answer: '', cited: [], unavailable: true, usage: r.usage };
      if (!r.finished) return unavailable;
      try {
        const parsed = Reply.safeParse(JSON.parse(r.text));
        return parsed.success ? { ...parsed.data, usage: r.usage } : unavailable;
      } catch {
        return unavailable;
      }
    },
  };
}
