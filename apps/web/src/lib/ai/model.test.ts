import { describe, expect, it } from 'vitest';
import { fakeModel } from './answer';
import { aiModel } from './model';

const env = (e: Record<string, string>) => e as unknown as NodeJS.ProcessEnv;

describe('the AI model choice', () => {
  it('is off unless set up, so production never runs the fake or a missing key', () => {
    expect(aiModel(env({}))).toBeNull();
    expect(aiModel(env({ AI_PROVIDER: 'claude' }))).toBeNull();
    expect(aiModel(env({ AI_PROVIDER: 'fake' }))).toBeNull();
    expect(aiModel(env({ AI_PROVIDER: 'fake', VERCEL_ENV: 'production', E2E_AUTH_CONFIRM: '1' }))).toBeNull();
  });
  it('runs the fake only outside production', () => {
    expect(aiModel(env({ AI_PROVIDER: 'fake', E2E_AUTH_CONFIRM: '1' }))).toBe(fakeModel);
    expect(aiModel(env({ AI_PROVIDER: 'fake', VERCEL_ENV: 'preview' }))).toBe(fakeModel);
  });
  it('uses Claude with a key', () => {
    const m = aiModel(env({ AI_PROVIDER: 'claude', ANTHROPIC_API_KEY: 'sk-test' }));
    expect(m).not.toBeNull();
    expect(m).not.toBe(fakeModel);
  });
});
