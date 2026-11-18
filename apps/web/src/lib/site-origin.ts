import { headers } from 'next/headers';

/**
 * The site's origin for links we hand out (invite links, sign-in callbacks).
 * Production sets NEXT_PUBLIC_SITE_URL. Previews and local use the request: the Origin header on a POST,
 * otherwise the forwarded protocol (first value of a proxy chain) and the Host header.
 */
export function originFrom(configured: string | undefined, h: Headers): string {
  if (configured) return configured.replace(/\/+$/, '');
  const origin = h.get('origin');
  if (origin) return origin;
  const host = h.get('host');
  if (!host) return 'http://localhost:3000';
  const proto = (h.get('x-forwarded-proto') ?? 'http').split(',')[0].trim();
  return `${proto === 'https' ? 'https' : 'http'}://${host}`;
}

export async function siteOrigin(): Promise<string> {
  return originFrom(process.env.NEXT_PUBLIC_SITE_URL, await headers());
}
