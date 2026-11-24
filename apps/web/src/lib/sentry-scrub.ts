// S0-08: nothing personal reaches Sentry. sendDefaultPii is off as well; this catches what slips into messages,
// exception text, breadcrumbs and request details.
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
// JWTs and other long opaque strings, such as session or invite tokens.
const TOKEN = /\b(?:eyJ[\w-]+\.[\w-]+\.[\w-]+|[A-Za-z0-9_-]{40,})\b/g;

export function scrubText(text: string): string {
  return text.replace(EMAIL, '[email]').replace(TOKEN, '[token]');
}

// Path parts that can be secrets or identify someone, such as invite codes and ids (from the Codex review).
const ID_SEGMENT = /\/[A-Za-z0-9_-]{16,}(?=\/|$)/g;
// Contexts the SDK fills with machine facts only; anything else (request bodies, custom data) is dropped.
const SAFE_CONTEXTS = ['os', 'runtime', 'browser', 'device', 'app', 'trace', 'culture'];

/** The URL without its query, fragment or id-like path parts. */
export function scrubUrl(url: string): string {
  return url.split(/[?#]/)[0]!.replace(/^(https?:\/\/[^/]+)?(.*)$/, (_, host = '', path: string) => host + path.replace(ID_SEGMENT, '/[id]'));
}

type Event = {
  message?: string;
  extra?: unknown;
  contexts?: Record<string, unknown>;
  user?: unknown;
  request?: { url?: string; [k: string]: unknown };
  exception?: { values?: { value?: string; [k: string]: unknown }[] };
  breadcrumbs?: { message?: string; data?: unknown; [k: string]: unknown }[];
  [k: string]: unknown;
};

/** A copy of the event with the user removed, the request cut to its path, and every text scrubbed. */
export function scrubEvent<E extends Event>(event: E): E {
  const out: E = { ...event };
  delete out.user;
  delete out.extra;
  if (out.contexts) out.contexts = Object.fromEntries(Object.entries(out.contexts).filter(([k]) => SAFE_CONTEXTS.includes(k)));
  if (out.request) out.request = out.request.url ? { url: scrubUrl(out.request.url) } : {};
  if (out.message) out.message = scrubText(out.message);
  if (out.exception?.values) out.exception = { ...out.exception, values: out.exception.values.map((v) => (v.value ? { ...v, value: scrubText(v.value) } : v)) };
  if (out.breadcrumbs)
    out.breadcrumbs = out.breadcrumbs.map(({ data: _data, ...b }) => (b.message ? { ...b, message: scrubText(b.message) } : b));
  return out;
}
