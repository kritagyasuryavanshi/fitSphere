import { describe, expect, it } from 'vitest';
import { readiness, youtubeId } from './lesson-draft';

describe('youtubeId', () => {
  it.each([
    ['https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
    ['https://youtu.be/dQw4w9WgXcQ?t=10', 'dQw4w9WgXcQ'],
    ['https://www.youtube.com/shorts/dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
    ['https://m.youtube.com/embed/dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
    ['dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
  ])('reads %s', (url, id) => {
    expect(youtubeId(url)).toBe(id);
  });

  it.each(['', 'https://vimeo.com/123', 'https://evil.com/watch?v=dQw4w9WgXcQ', 'https://youtube.com/watch?v=short'])('rejects %j', (url) => {
    expect(youtubeId(url)).toBeNull();
  });
});

describe('readiness', () => {
  const ready = { videoId: 'dQw4w9WgXcQ', steps: ['a', 'b', 'c'], mistakes: 'x', safety: 'y', needsSupports: false, supports: [], needsMuscles: false, muscles: [] };

  it('is ready with a video, 3 steps, mistakes and safety', () => {
    expect(readiness(ready).ready).toBe(true);
  });

  it('stays not ready until every check passes', () => {
    expect(readiness({ ...ready, videoId: null }).ready).toBe(false);
    expect(readiness({ ...ready, steps: ['a', ' ', 'c'] }).ready).toBe(false);
    expect(readiness({ ...ready, mistakes: '  ' }).ready).toBe(false);
    expect(readiness({ ...ready, safety: '' }).ready).toBe(false);
    expect(readiness({ ...ready, needsSupports: true }).ready).toBe(false);
    expect(readiness({ ...ready, needsMuscles: true, muscles: ['chest'] }).ready).toBe(true);
  });

  it('lists each check with its state', () => {
    expect(readiness({ ...ready, safety: '' }).checks.map((c) => [c.label, c.done])).toEqual([
      ['Public video linked', true],
      ['At least 3 steps', true],
      ['Common mistakes', true],
      ['Safety guidance', false],
    ]);
  });
});
