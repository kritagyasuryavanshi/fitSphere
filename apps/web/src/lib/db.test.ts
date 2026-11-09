import { afterEach, describe, expect, it, vi } from 'vitest';
import { db } from './db';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('db', () => {
  it('builds a client from the environment', () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'http://127.0.0.1:54321');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'test-key');
    expect(typeof db().from).toBe('function');
  });

  it('names the problem when the environment is not set', () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', '');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'test-key');
    expect(() => db()).toThrow(/URL/);
  });
});
