import { describe, expect, it } from 'vitest';
import { normaliseEmail } from './email';

describe('normaliseEmail', () => {
  it('accepts a full address and trims and lowercases it', () => {
    expect(normaliseEmail('  Kabir@Example.com ')).toBe('kabir@example.com');
  });

  it.each(['', 'kabir', 'kabir@example', '@example.com', 'kabir@.com', 'ka bir@example.com', 'kabir@@example.com', 'kabir@example.'])(
    'rejects %j',
    (input) => {
      expect(normaliseEmail(input)).toBeNull();
    },
  );

  it('rejects an address longer than 254 characters', () => {
    expect(normaliseEmail(`${'a'.repeat(250)}@x.io`)).toBeNull();
  });
});
