import { formatInr } from '@fitsphere/core';
import { shortDate } from './dates';
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
export const TEMPLATES = [
  'coach_feedback',
  'new_lesson',
  'session_reminder',
  'coach_approved',
  'coach_declined',
  'coaching_cancelled',
  'coaching_renewed',
  'renewal_failed',
  'coaching_lapsed',
  'coaching_ended',
  'coaching_stopped',
];

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
  if (template === 'new_lesson') {
    const coach = str(data.coach) || 'Your coach';
    // Only a path inside the site: a stored link is never trusted to point elsewhere.
    const path = /^\/[a-z0-9/_-]*$/i.test(str(data.link)) ? str(data.link) : '/learn';
    return {
      subject: `New lesson from ${coach}: ${str(data.title)}`,
      text: [`${coach} published a new lesson: ${str(data.title)}.`, '', `Watch it: ${origin}${path}`, '', `Turn these emails off: ${origin}/account/notifications`].join('\n'),
    };
  }
  if (template === 'session_reminder') {
    return {
      subject: `Today: ${str(data.what) || 'your session'}`,
      text: [`Your session is ready: ${str(data.what) || 'today'}.`, '', `Open Today: ${origin}/today`, '', `Turn these emails off: ${origin}/account/notifications`].join('\n'),
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
  if (template.startsWith('coaching_') || template === 'renewal_failed') return coachingEmail(template, data, origin);
  return null;
}

/** A change to paid coaching (M4-11), written for the athlete or the coach (data.role). */
function coachingEmail(template: string, data: Record<string, unknown>, origin: string): Omit<Email, 'id' | 'to'> | null {
  const coachView = data.role === 'coach';
  const other = str(data.other) || (coachView ? 'your client' : 'your coach');
  const Other = other.charAt(0).toUpperCase() + other.slice(1);
  const pkg = str(data.package) || 'coaching';
  const until = /^\d{4}-\d{2}-\d{2}$/.test(str(data.paid_through)) ? shortDate(str(data.paid_through)) : '';
  const amount = typeof data.amount === 'number' ? formatInr(data.amount) : '';
  const link = coachView ? `${origin}/coach/clients` : `${origin}/coaching`;
  const lines = (...l: string[]) => [...l, '', link].join('\n');
  switch (template) {
    case 'coaching_cancelled':
      return coachView
        ? { subject: `${Other} cancelled ${pkg}`, text: lines(`${Other} cancelled ${pkg}.`, `${Other} stays your client until ${until}. No more payments are taken.`) }
        : { subject: `Your coaching with ${other} is cancelled`, text: lines(`You cancelled ${pkg} with ${other}.`, `You keep coaching until ${until}. No more payments are taken.`) };
    case 'coaching_renewed':
      return coachView
        ? { subject: `${Other} renewed ${pkg}`, text: lines(`${Other} paid ${amount} for another month of ${pkg}, until ${until}.`) }
        : { subject: `Your coaching with ${other} is renewed`, text: lines(`We received ${amount} for another month of ${pkg} with ${other}, until ${until}.`) };
    case 'renewal_failed':
      return coachView
        ? { subject: `A payment from ${other} did not go through`, text: lines(`${Other}'s renewal for ${pkg} did not go through. The payment provider will try again.`) }
        : { subject: `Your payment for ${pkg} did not go through`, text: lines(`Your renewal for ${pkg} with ${other} did not go through. We will try again; check your payment method.`) };
    case 'coaching_lapsed':
      return coachView
        ? { subject: `Coaching with ${other} has ended`, text: lines(`${Other}'s payment could not be taken after several tries, so ${pkg} has ended.`) }
        : { subject: `Your coaching with ${other} has ended`, text: lines(`Your payment could not be taken after several tries, so ${pkg} with ${other} has ended.`, 'You can hire again at any time.') };
    case 'coaching_stopped':
      // The coach can no longer coach on FitSphere (suspended, or the coach role removed): renewals stop.
      // The coach may have lost the coach role, so their link is the account page, not the coach tools.
      return coachView
        ? {
            subject: `Coaching with ${other} will not renew`,
            text: [`Your coaching account can no longer take payments, so ${pkg} with ${other} will not renew.`, `It runs until ${until}.`, '', `${origin}/account`].join('\n'),
          }
        : {
            subject: `Your coaching with ${other} will not renew`,
            text: lines(
              `${Other} can no longer take payments on FitSphere, so ${pkg} will not renew.`,
              `You keep coaching until ${until}. No more payments are taken; if one goes through by mistake, it is refunded.`,
            ),
          };
    case 'coaching_ended':
      return coachView
        ? { subject: `Coaching with ${other} has ended`, text: lines(`${pkg} with ${other} has ended. You no longer see their logs.`) }
        : { subject: `Your coaching with ${other} has ended`, text: lines(`${pkg} with ${other} has ended. Your logs and past feedback stay with you.`) };
    default:
      return null;
  }
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
