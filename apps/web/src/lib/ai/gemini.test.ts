import { afterEach, describe, expect, it, vi } from 'vitest';
import { geminiJson, geminiModel } from './gemini';

const reply = (body: unknown) => vi.fn(async () => new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } }));
const candidate = (text: string, finishReason = 'STOP') => ({
  candidates: [{ content: { parts: [{ text: 'thinking...', thought: true }, { text }] }, finishReason }],
  usageMetadata: { promptTokenCount: 120, candidatesTokenCount: 30, thoughtsTokenCount: 10 },
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('the Gemini model', () => {
  it('sends the key in a header and returns the structured reply with its usage, skipping thinking parts', async () => {
    const f = reply(candidate('{"answer":"Hands high.","cited":["a"],"needs_referral":false}'));
    vi.stubGlobal('fetch', f);
    const r = await geminiModel('k').answer({ system: 's', user: 'u' });
    expect(r).toEqual({ answer: 'Hands high.', cited: ['a'], needs_referral: false, usage: { input_tokens: 120, output_tokens: 40, provider: 'gemini' } });
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent');
    expect((init.headers as Record<string, string>)['x-goog-api-key']).toBe('k');
    expect(url).not.toContain('k=');
  });

  it('marks a reply cut short, or one that breaks the schema, as unavailable but keeps its usage', async () => {
    vi.stubGlobal('fetch', reply(candidate('{"answer":"x"', 'MAX_TOKENS')));
    expect(await geminiModel('k').answer({ system: 's', user: 'u' })).toMatchObject({ unavailable: true, usage: { input_tokens: 120 } });
    vi.stubGlobal('fetch', reply(candidate('{"answer": 5}')));
    expect(await geminiModel('k').answer({ system: 's', user: 'u' })).toMatchObject({ unavailable: true });
  });

  it('turns an HTTP error into an error the answer service handles', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('bad', { status: 400 })));
    await expect(geminiJson('k', 's', 'u', {})).rejects.toThrow('Gemini 400');
  });

  it('waits and retries when the free tier is busy', async () => {
    vi.useFakeTimers();
    const f = vi.fn().mockResolvedValueOnce(new Response('quota', { status: 429 })).mockResolvedValueOnce(new Response(JSON.stringify(candidate('{"answer":"a","cited":[],"needs_referral":false}')), { status: 200 }));
    vi.stubGlobal('fetch', f);
    const done = geminiJson('k', 's', 'u', {});
    await vi.advanceTimersByTimeAsync(20_000);
    expect((await done).finished).toBe(true);
    expect(f).toHaveBeenCalledTimes(2);
  });

  it('retries a timeout or a server error too', async () => {
    vi.useFakeTimers();
    const f = vi
      .fn()
      .mockRejectedValueOnce(Object.assign(new Error('timed out'), { name: 'TimeoutError' }))
      .mockResolvedValueOnce(new Response('oops', { status: 500 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(candidate('{"answer":"a","cited":[],"needs_referral":false}')), { status: 200 }));
    vi.stubGlobal('fetch', f);
    const done = geminiJson('k', 's', 'u', {});
    await vi.advanceTimersByTimeAsync(60_000);
    expect((await done).finished).toBe(true);
    expect(f).toHaveBeenCalledTimes(3);
  });
});
