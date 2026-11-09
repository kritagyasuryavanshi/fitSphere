import { describe, expect, expectTypeOf, it } from 'vitest';
import { createDbClient, type Database } from './index';

describe('createDbClient', () => {
  it('builds a client for a URL and key', () => {
    const client = createDbClient('http://127.0.0.1:54321', 'test-key');
    expect(typeof client.from).toBe('function');
  });

  it('refuses a missing URL or key instead of failing later', () => {
    expect(() => createDbClient('', 'test-key')).toThrow(/URL/);
    expect(() => createDbClient('http://127.0.0.1:54321', '')).toThrow(/key/);
  });

  it('exposes the generated schema types', () => {
    expectTypeOf<Database>().toHaveProperty('public');
  });
});
