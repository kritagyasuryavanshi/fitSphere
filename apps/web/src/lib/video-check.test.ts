import { describe, expect, it, vi } from 'vitest';
import { authorised, videoIsBroken } from './video-check';

const reply = (status: number) => vi.fn(async () => new Response(null, { status }));

describe('videoIsBroken', () => {
  it('asks YouTube oEmbed about the video', async () => {
    const fetcher = reply(200);
    await videoIsBroken('dQw4w9WgXcQ', fetcher);
    expect(String((fetcher.mock.calls[0] as unknown[])[0])).toBe('https://www.youtube.com/oembed?format=json&url=https%3A%2F%2Fwww.youtube.com%2Fwatch%3Fv%3DdQw4w9WgXcQ');
  });

  it('is fine when YouTube answers 200', async () => {
    expect(await videoIsBroken('dQw4w9WgXcQ', reply(200))).toBe(false);
  });

  it.each([401, 403, 404])('is broken when a removed or private video answers %i', async (status) => {
    expect(await videoIsBroken('dQw4w9WgXcQ', reply(status))).toBe(true);
  });

  it('is unknown on a server error or a network failure, so the flag stays as it was', async () => {
    expect(await videoIsBroken('dQw4w9WgXcQ', reply(503))).toBeNull();
    expect(await videoIsBroken('dQw4w9WgXcQ', vi.fn(async () => Promise.reject(new Error('offline'))))).toBeNull();
  });
});

describe('authorised', () => {
  it('needs the exact bearer secret, and refuses when no secret is set', () => {
    expect(authorised('Bearer s3cret', 's3cret')).toBe(true);
    expect(authorised('Bearer wrong!', 's3cret')).toBe(false);
    expect(authorised(null, 's3cret')).toBe(false);
    expect(authorised('Bearer ', '')).toBe(false);
  });
});
