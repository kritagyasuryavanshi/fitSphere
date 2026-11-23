// S0-08: nothing personal reaches Sentry. sendDefaultPii is off as well; this catches what slips into messages,
// exception text, breadcrumbs and request details.
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
// JWTs and other long opaque strings, such as session or invite tokens.
const TOKEN = /\b(?:eyJ[\w-]+\.[\w-]+\.[\w-]+|[A-Za-z0-9_-]{40,})\b/g;

export function scrubText(text: string): string {
  return text.replace(EMAIL, '[email]').replace(TOKEN, '[token]');
}

type Event = {
  message?: string;
  user?: unknown;
  request?: { url?: string; [k: string]: unknown };
  exception?: { values?: { value?: string; [k: string]: unknown }[] };
  breadcrumbs?: { message?: string; [k: string]: unknown }[];
  [k: string]: unknown;
};

/** A copy of the event with the user removed, the request cut to its path, and every text scrubbed. */
export function scrubEvent<E extends Event>(event: E): E {
  const out: E = { ...event };
  delete out.user;
  if (out.request) out.request = out.request.url ? { url: out.request.url.split(/[?#]/)[0] } : {};
  if (out.message) out.message = scrubText(out.message);
  if (out.exception?.values) out.exception = { ...out.exception, values: out.exception.values.map((v) => (v.value ? { ...v, value: scrubText(v.value) } : v)) };
  if (out.breadcrumbs) out.breadcrumbs = out.breadcrumbs.map((b) => (b.message ? { ...b, message: scrubText(b.message) } : b));
  return out;
}
