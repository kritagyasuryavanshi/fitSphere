import { describe, expect, it } from 'vitest';
import { config } from './proxy';

// The matcher is a regular expression in a string. A lost backslash once made it skip every page but "/".
const matches = (path: string) => new RegExp(`^${config.matcher[0]}$`).test(path);

describe('proxy matcher', () => {
  it.each(['/', '/today', '/coach', '/admin/people', '/welcome/2', '/sign-in'])('refreshes the session on %s', (path) => {
    expect(matches(path)).toBe(true);
  });

  it.each(['/images/gloves-black.jpg', '/favicon.ico', '/_next/static/chunk.js', '/auth/callback', '/auth/confirm'])('skips %s', (path) => {
    expect(matches(path)).toBe(false);
  });
});
