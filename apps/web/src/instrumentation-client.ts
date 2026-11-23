import * as Sentry from '@sentry/nextjs';
import { sentryOptions } from './lib/sentry-options';

// S0-08: browser errors to Sentry, scrubbed. Off until NEXT_PUBLIC_SENTRY_DSN is set (owner item O-11).
Sentry.init(sentryOptions(process.env.NEXT_PUBLIC_SENTRY_DSN));
