import { timingSafeEqual } from 'node:crypto';

type Fetcher = (url: string, init?: RequestInit) => Promise<Response>;

/** true when YouTube says the video is gone or private, false when it plays, null when YouTube could not tell us. */
export async function videoIsBroken(id: string, fetcher: Fetcher = fetch): Promise<boolean | null> {
  const url = `https://www.youtube.com/oembed?${new URLSearchParams({ format: 'json', url: `https://www.youtube.com/watch?v=${id}` })}`;
  try {
    const res = await fetcher(url, { signal: AbortSignal.timeout(5_000) });
    if (res.ok) return false;
    return [401, 403, 404].includes(res.status) ? true : null;
  } catch {
    return null;
  }
}

/** The cron caller sends `Authorization: Bearer <CRON_SECRET>`. No secret configured means no access. */
export function authorised(header: string | null, secret: string | undefined): boolean {
  if (!secret || !header) return false;
  const given = Buffer.from(header);
  const wanted = Buffer.from(`Bearer ${secret}`);
  return given.length === wanted.length && timingSafeEqual(given, wanted);
}
