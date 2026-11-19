import { createDbClient } from '@fitsphere/db';
import { drainOutbox, type Email, type OutboxRow } from './email';

// shortcut: Resend through its HTTP API, no SDK; swap the send function for SMTP if the provider changes.
// Resend allows about 2 requests a second; pace sends a little under that.
const PACE_MS = 600;
let lastSend = 0;
async function resend(m: Email) {
  const wait = lastSend + PACE_MS - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastSend = Date.now();
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'content-type': 'application/json',
      // The same outbox row is never delivered twice, even if marking it sent failed.
      'idempotency-key': `outbox-${m.id}`,
    },
    body: JSON.stringify({ from: process.env.EMAIL_FROM, to: m.to, subject: m.subject, text: m.text }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`resend ${res.status}`);
}

/** The daily reminder job: notifies (and, if wanted, emails) athletes with a session today. Returns how many. */
export async function queueSessionReminders() {
  if (!process.env.SUPABASE_SECRET_KEY) return null;
  const db = createDbClient(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '', process.env.SUPABASE_SECRET_KEY);
  const { data, error } = await db.rpc('queue_session_reminders');
  if (error) throw error;
  return data;
}

/**
 * Sends what waits in email_outbox. Without RESEND_API_KEY, EMAIL_FROM and NEXT_PUBLIC_SITE_URL nothing is sent and
 * every email stays queued (for up to 7 days). Links use the configured site address, never a request's host, so one
 * person's preview URL never ends up in another person's email. Uses the secret key: call only from server code that
 * has already checked its caller.
 */
export async function sendQueuedEmails() {
  const origin = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, '');
  if (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM || !origin || !process.env.SUPABASE_SECRET_KEY) return null;
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
    resend,
    origin,
  );
}
