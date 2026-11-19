// The email outbox sender (M3-14). Database functions queue rows in email_outbox in the same transaction as the event;
// this drains them. The provider is injected, so tests use a fake and production uses Resend once a key exists.

export type OutboxRow = { id: number; to_email: string; template: string; data: Record<string, unknown> };
export type Email = { to: string; subject: string; text: string };
export type Outbox = { unsent: (limit: number) => Promise<OutboxRow[]>; markSent: (id: number) => Promise<void> };

const str = (v: unknown) => (typeof v === 'string' ? v : '');

/** Subject and plain-text body for a queued template; null for a template this sender does not know. */
export function renderEmail(template: string, data: Record<string, unknown>, origin: string): Omit<Email, 'to'> | null {
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
 * next run; a failed send stays queued for the next run. An unknown template stays queued for a sender that knows it.
 */
export async function drainOutbox(db: Outbox, send: (m: Email) => Promise<void>, origin = '', limit = 50) {
  const result = { sent: 0, failed: 0, skipped: 0 };
  for (const row of await db.unsent(limit)) {
    const email = renderEmail(row.template, row.data, origin);
    if (!email) {
      result.skipped++;
      continue;
    }
    try {
      await send({ to: row.to_email, ...email });
    } catch {
      result.failed++;
      continue;
    }
    await db.markSent(row.id);
    result.sent++;
  }
  return result;
}
