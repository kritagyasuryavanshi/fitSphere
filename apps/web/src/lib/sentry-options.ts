import { scrubEvent, scrubText } from './sentry-scrub';

// S0-08: errors only (no tracing, no replay), nothing personal. Without a DSN, Sentry stays off.
export function sentryOptions(dsn: string | undefined) {
  return {
    dsn,
    enabled: !!dsn,
    sendDefaultPii: false,
    tracesSampleRate: 0,
    beforeSend: <E extends object>(event: E) => scrubEvent(event as Parameters<typeof scrubEvent>[0]) as E,
    beforeBreadcrumb: <B extends { message?: string }>(crumb: B) => (crumb.message ? { ...crumb, message: scrubText(crumb.message) } : crumb),
  };
}
