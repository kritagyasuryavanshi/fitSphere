import * as Sentry from '@sentry/nextjs';
import { sentryOptions } from './lib/sentry-options';

// S0-08: server and edge errors to Sentry, scrubbed. Off until SENTRY_DSN is set (owner item O-11).
export function register() {
  Sentry.init(sentryOptions(process.env.SENTRY_DSN));
}

export const onRequestError = Sentry.captureRequestError;
