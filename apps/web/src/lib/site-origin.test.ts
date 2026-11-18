import { describe, expect, it } from 'vitest';
import { originFrom } from './site-origin';

const h = (values: Record<string, string>) => new Headers(values);

describe('originFrom', () => {
  it('prefers the configured site URL, without a trailing slash', () => {
    expect(originFrom('https://fitsphere.in/', h({ host: 'evil.test' }))).toBe('https://fitsphere.in');
  });
  it('uses the Origin header next', () => {
    expect(originFrom(undefined, h({ origin: 'https://preview.vercel.app', host: 'x' }))).toBe('https://preview.vercel.app');
  });
  it('takes the first value of a chained forwarded protocol', () => {
    expect(originFrom(undefined, h({ 'x-forwarded-proto': 'https,http', host: 'preview.vercel.app' }))).toBe('https://preview.vercel.app');
  });
  it('falls back to http on the host, then to localhost', () => {
    expect(originFrom(undefined, h({ host: 'localhost:3100' }))).toBe('http://localhost:3100');
    expect(originFrom(undefined, h({}))).toBe('http://localhost:3000');
  });
});
