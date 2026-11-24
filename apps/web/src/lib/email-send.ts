import { createDbClient } from '@fitsphere/db';
import { createTransport } from 'nodemailer';
import { drainOutbox, type Email, type OutboxRow } from './email';

// Two senders: Gmail SMTP (free, no domain, about 500 emails a day) for the invite beta, or Resend once a domain
// is verified. Gmail wins when both are set.
type Env = Record<string, string | undefined>;
export function mailProvider(env: Env): { kind: 'smtp' | 'resend'; from: string } | null {
  if (env.SMTP_USER && env.SMTP_PASS) return { kind: 'smtp', from: env.EMAIL_FROM || `FitSphere <${env.SMTP_USER}>` };
  if (env.RESEND_API_KEY && env.EMAIL_FROM) return { kind: 'resend', from: env.EMAIL_FROM };
  return null;
}

// Resend allows about 2 requests a second; Gmail throttles bursts too. Pace sends a little under that.
const PACE_MS = 600;
let lastSend = 0;
async function pace() {
  const wait = lastSend + PACE_MS - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastSend = Date.now();
}

async function resend(m: Email, from: string) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'content-type': 'application/json',
      // The same outbox row is never delivered twice, even if marking it sent failed.
      'idempotency-key': `outbox-${m.id}`,
    },
    body: JSON.stringify({ from, to: m.to, subject: m.subject, text: m.text }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`resend ${res.status}`);
}

// shortcut: SMTP has no idempotency key, so if marking a row sent fails, that one email can go twice; fine for a beta.
let transport: ReturnType<typeof createTransport> | null = null;
async function smtp(m: Email, from: string) {
  transport ??= createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    connectionTimeout: 10_000,
    socketTimeout: 10_000,
  });
  await transport.sendMail({ from, to: m.to, subject: m.subject, text: m.text });
}

/** The daily reminder job: notifies (and, if wanted, emails) athletes with a session today. Returns how many. */
export async function queueSessionReminders() {
  if (!process.env.SUPABASE_SECRET_KEY) return null;
  const db = createDbClient(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '', process.env.SUPABASE_SECRET_KEY);
  const { data, error } = await db.rpc('queue_session_reminders');
  if (error) throw error;
  return data;
}

/** Ends paid coaching that ran out, and lapses renewals the provider went silent on (sweep_engagements). */
export async function sweepEngagements() {
  if (!process.env.SUPABASE_SECRET_KEY) return null;
  const db = createDbClient(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '', process.env.SUPABASE_SECRET_KEY);
  const { data, error } = await db.rpc('sweep_engagements');
  if (error) throw error;
  return data;
}

/**
 * Sends what waits in email_outbox. Without a sender (see mailProvider) and NEXT_PUBLIC_SITE_URL nothing is sent and
 * every email stays queued (for up to 7 days). Links use the configured site address, never a request's host, so one
 * person's preview URL never ends up in another person's email. Uses the secret key: call only from server code that
 * has already checked its caller.
 */
export async function sendQueuedEmails() {
  const origin = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, '');
  const provider = mailProvider(process.env);
  if (!provider || !origin || !process.env.SUPABASE_SECRET_KEY) return null;
  const send = provider.kind === 'smtp' ? smtp : resend;
  const db = createDbClient(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '', process.env.SUPABASE_SECRET_KEY);
  return drainOutbox(
    {
      claim: async (templates, limit) => {
        const { data, error } = await db.rpc('claim_emails', { templates, max_rows: limit });
        if (error) throw error;
        return data as OutboxRow[];
      },
      markSent: async (id) => {
        const { error } = await db.from('email_outbox').update({ sent_at: new Date().toISOString() }).eq('id', id);
        if (error) throw error;
      },
    },
    async (m) => {
      await pace();
      await send(m, provider.from);
    },
    origin,
  );
}
