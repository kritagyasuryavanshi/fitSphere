import { createDbClient } from '@fitsphere/db';
import { drainOutbox, type Email, type OutboxRow } from './email';

// shortcut: Resend through its HTTP API, no SDK; swap the send function for SMTP if the provider changes.
async function resend(m: Email) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({ from: process.env.EMAIL_FROM, to: m.to, subject: m.subject, text: m.text }),
  });
  if (!res.ok) throw new Error(`resend ${res.status}`);
}

/**
 * Sends what waits in email_outbox. Without RESEND_API_KEY and EMAIL_FROM nothing is sent and every email stays
 * queued, so turning the provider on later delivers them. Uses the secret key: call only from server code that
 * has already checked its caller.
 */
export async function sendQueuedEmails(origin: string) {
  if (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM || !process.env.SUPABASE_SECRET_KEY) return null;
  const db = createDbClient(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '', process.env.SUPABASE_SECRET_KEY);
  return drainOutbox(
    {
      unsent: async (limit) => {
        const { data, error } = await db.from('email_outbox').select('id, to_email, template, data').is('sent_at', null).order('created_at').limit(limit);
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
