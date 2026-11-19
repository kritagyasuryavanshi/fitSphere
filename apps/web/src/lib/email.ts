// The email outbox sender (M3-14). Database functions queue rows in email_outbox in the same transaction as the event;
// this drains them. The provider is injected, so tests use a fake and production uses Resend once a key exists.

export type OutboxRow = { id: number; to_email: string; template: string; data: Record<string, unknown>; attempts?: number };
/** id is the outbox row, so the provider can refuse a repeat (an idempotency key). */
export type Email = { id: number; to: string; subject: string; text: string };

/** claim_emails gives up on an email after this many tries. */
export const MAX_ATTEMPTS = 5;
/** claim reserves a batch atomically (claim_emails in the database), so two runs never get the same row. */
export type Outbox = { claim: (templates: string[], limit: number) => Promise<OutboxRow[]>; markSent: (id: number) => Promise<void> };

/** The templates this sender writes; others stay queued for a sender that knows them. */
export const TEMPLATES = ['coach_feedback', 'coach_approved', 'coach_declined'];

const str = (v: unknown) => (typeof v === 'string' ? v : '');

/** Subject and plain-text body for a queued template; null for a template this sender does not know. */
export function renderEmail(template: string, data: Record<string, unknown>, origin: string): Omit<Email, 'id' | 'to'> | null {
  if (template === 'coach_feedback') {
    const coach = str(data.coach) || 'Your coach';
    const program = str(data.program);
    return {
      subject: `${coach} sent you feedback`,
      text: [
        `${coach} sent you feedback${program ? ` on ${program}` : ''}:`,
        '',
        str(data.excerpt),
        '',
        `Read it and reply: ${origin}/account/feedback`,
        '',
        `You can turn these emails off on that page.`,
      ].join('\n'),
    };
  }
  if (template === 'coach_approved') {
    return {
      subject: 'You are a FitSphere coach',
      text: [`Hello ${str(data.name) || 'coach'},`, '', 'Your coach application is approved. Your coach tools are on.', '', `Start here: ${origin}/coach`].join('\n'),
    };
  }
  if (template === 'coach_declined') {
    return {
      subject: 'Your FitSphere coach application',
      text: [`Hello ${str(data.name) || 'there'},`, '', 'Thank you for applying to coach on FitSphere. We could not approve your application this time.', '', `You can still train on FitSphere: ${origin}/today`].join('\n'),
    };
  }
  return null;
}

/**
 * Sends queued emails one by one. A sent email is marked at once, so a crash part-way never sends it twice on the
 * next run; a failed send stays queued and is retried after a rest. Unknown templates are never claimed.
 */
export async function drainOutbox(db: Outbox, send: (m: Email) => Promise<void>, origin = '', limit = 50) {
  const result = { sent: 0, failed: 0, skipped: 0 };
  for (const row of await db.claim(TEMPLATES, limit)) {
    const email = renderEmail(row.template, row.data, origin);
    if (!email) {
      result.skipped++;
      continue;
    }
    try {
      await send({ id: row.id, to: row.to_email, ...email });
    } catch (e) {
      result.failed++;
      const reason = e instanceof Error ? e.message : String(e);
      console.error((row.attempts ?? 0) >= MAX_ATTEMPTS ? 'email failed and gave up' : 'email failed, will retry', row.id, row.template, reason);
      continue;
    }
    result.sent++;
    // Sent already: a failed mark must not stop the run. The idempotency key stops the provider sending it twice.
    try {
      await db.markSent(row.id);
    } catch (e) {
      console.error('email sent but not marked', row.id, e instanceof Error ? e.message : String(e));
    }
  }
  return result;
}
