import { describe, expect, it } from 'vitest';
import { scrubEvent, scrubText } from './sentry-scrub';

describe('Sentry scrubbing (S0-08)', () => {
  it('removes email addresses and long tokens from text', () => {
    expect(scrubText('No profile for kabir.s@example.com')).toBe('No profile for [email]');
    expect(scrubText('token eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.abcdefghijklmnop failed')).toBe('token [token] failed');
  });

  it('drops the user, cookies, headers, query strings and request bodies', () => {
    const out = scrubEvent({
      message: 'Login for a@b.co failed',
      user: { id: 'u1', email: 'a@b.co', ip_address: '1.2.3.4' },
      request: { url: 'https://x.test/join/abc?code=123&email=a@b.co', cookies: { sb: 'secret' }, headers: { cookie: 'sb=1', authorization: 'Bearer x' }, data: '{"dob":"1990-01-01"}', query_string: 'email=a@b.co' },
      exception: { values: [{ type: 'Error', value: 'user a@b.co not found' }] },
      breadcrumbs: [{ message: 'fetch https://x.test/api?email=a@b.co' }],
    });
    expect(out.user).toBeUndefined();
    expect(out.request).toEqual({ url: 'https://x.test/join/abc' });
    expect(out.message).toBe('Login for [email] failed');
    expect(out.exception?.values?.[0]?.value).toBe('user [email] not found');
    expect(out.breadcrumbs?.[0]?.message).toBe('fetch https://x.test/api?email=[email]');
  });
});
