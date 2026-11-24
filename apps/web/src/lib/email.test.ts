import { describe, expect, it, vi } from 'vitest';
import { drainOutbox, renderEmail, TEMPLATES, type OutboxRow } from './email';

const row = (id: number, to: string, over: Partial<OutboxRow> = {}): OutboxRow => ({
  id,
  to_email: to,
  template: 'coach_feedback',
  data: { coach: 'Vikram', program: 'Ring Basics', excerpt: 'Keep the rear hand up.' },
  ...over,
});

// A fake outbox: the rows waiting, and which ids got marked sent.
function fakeDb(rows: OutboxRow[]) {
  const marked: number[] = [];
  return {
    marked,
    db: {
      claim: async (templates: string[], limit: number) => rows.filter((r) => !marked.includes(r.id) && templates.includes(r.template)).slice(0, limit),
      markSent: async (id: number) => {
        marked.push(id);
      },
    },
  };
}

describe('drainOutbox', () => {
  it('sends one email per feedback note and marks each sent', async () => {
    const { db, marked } = fakeDb([row(1, 'neha@t.test'), row(2, 'ravi@t.test')]);
    const send = vi.fn(async () => {});
    expect(await drainOutbox(db, send)).toEqual({ sent: 2, failed: 0, skipped: 0 });
    expect(send).toHaveBeenCalledTimes(2);
    expect(send).toHaveBeenNthCalledWith(1, expect.objectContaining({ id: 1, to: 'neha@t.test', subject: 'Vikram sent you feedback' }));
    expect(marked).toEqual([1, 2]);
  });

  it('keeps a failed email queued for the next run and sends the rest', async () => {
    const { db, marked } = fakeDb([row(1, 'neha@t.test'), row(2, 'ravi@t.test')]);
    const send = vi.fn(async (m: { to: string }) => {
      if (m.to === 'neha@t.test') throw new Error('provider down');
    });
    expect(await drainOutbox(db, send)).toEqual({ sent: 1, failed: 1, skipped: 0 });
    expect(marked).toEqual([2]);
  });

  it('never claims an email with an unknown template, so it stays queued for a sender that knows it', async () => {
    const { db, marked } = fakeDb([row(1, 'neha@t.test', { template: 'no_such_template' }), row(2, 'ravi@t.test')]);
    const send = vi.fn(async () => {});
    expect(await drainOutbox(db, send)).toEqual({ sent: 1, failed: 0, skipped: 0 });
    expect(send).toHaveBeenCalledTimes(1);
    expect(marked).toEqual([2]);
  });
});

describe('renderEmail', () => {
  it('writes the coach, program and excerpt into a plain-text email with a link', () => {
    const m = renderEmail('coach_feedback', row(1, 'x').data, 'https://fit-sphere-xi.vercel.app');
    expect(m).toEqual({
      subject: 'Vikram sent you feedback',
      text: expect.stringContaining('Keep the rear hand up.'),
    });
    expect(m!.text).toContain('Ring Basics');
    expect(m!.text).toContain('https://fit-sphere-xi.vercel.app/account/feedback');
  });

  it('falls back to "Your coach" without a name', () => {
    expect(renderEmail('coach_feedback', { excerpt: 'Hi' }, 'https://x')!.subject).toBe('Your coach sent you feedback');
  });

  it('writes the coach application decisions already queued since M1', () => {
    expect(renderEmail('coach_approved', { name: 'Vikram' }, 'https://x')).toEqual({ subject: 'You are a FitSphere coach', text: expect.stringContaining('https://x/coach') });
    expect(renderEmail('coach_declined', { name: 'Vikram' }, 'https://x')!.subject).toBe('Your FitSphere coach application');
  });
});

describe('drainOutbox failures', () => {
  it('logs a failed send with its reason, and says when an email is given up', async () => {
    const { db } = fakeDb([row(1, 'neha@t.test', { attempts: 5 })]);
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    await drainOutbox(db, async () => {
      throw new Error('resend 403');
    });
    expect(log).toHaveBeenCalledWith(expect.stringContaining('gave up'), 1, 'coach_feedback', 'resend 403');
    log.mockRestore();
  });

  it('keeps going when marking one email sent fails', async () => {
    const { db, marked } = fakeDb([row(1, 'neha@t.test'), row(2, 'ravi@t.test')]);
    const markSent = db.markSent;
    db.markSent = async (id: number) => {
      if (id === 1) throw new Error('db blip');
      await markSent(id);
    };
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const send = vi.fn(async () => {});
    expect(await drainOutbox(db, send)).toEqual({ sent: 2, failed: 0, skipped: 0 });
    expect(send).toHaveBeenCalledTimes(2);
    expect(marked).toEqual([2]);
    log.mockRestore();
  });

  it('passes each email its outbox id, so the provider can refuse a repeat', async () => {
    const { db } = fakeDb([row(7, 'neha@t.test')]);
    const send = vi.fn(async () => {});
    await drainOutbox(db, send);
    expect(send).toHaveBeenCalledWith(expect.objectContaining({ id: 7 }));
  });
});

describe('renderEmail for notifications (M3-16)', () => {
  it('writes the new lesson email with a link to the lesson', () => {
    const m = renderEmail('new_lesson', { coach: 'Vikram', title: 'The Jab', link: '/learn/boxing/jab' }, 'https://x');
    expect(m!.subject).toBe('New lesson from Vikram: The Jab');
    expect(m!.text).toContain('https://x/learn/boxing/jab');
  });

  it('writes the session reminder with a link to Today', () => {
    const m = renderEmail('session_reminder', { what: 'Jab and footwork' }, 'https://x');
    expect(m!.subject).toBe('Today: Jab and footwork');
    expect(m!.text).toContain('https://x/today');
  });

  it('only links inside the site, whatever the stored link says', () => {
    expect(renderEmail('new_lesson', { coach: 'V', title: 'T', link: 'https://evil.test/x' }, 'https://x')!.text).toContain('https://x/learn');
  });
});


describe('renderEmail for coaching changes (M4-11)', () => {
  const athlete = { role: 'athlete', other: 'Vikram', package: 'Online coaching', paid_through: '2026-12-15', amount: 450000 };
  const coach = { ...athlete, role: 'coach', other: 'Kabir' };

  it('tells the athlete and the coach about a cancel, with the last day', () => {
    const a = renderEmail('coaching_cancelled', athlete, 'https://x')!;
    expect(a.subject).toBe('Your coaching with Vikram is cancelled');
    expect(a.text).toContain('You keep coaching until 15 Dec.');
    const c = renderEmail('coaching_cancelled', coach, 'https://x')!;
    expect(c.subject).toBe('Kabir cancelled Online coaching');
    expect(c.text).toContain('Kabir stays your client until 15 Dec.');
    expect(c.text).toContain('https://x/coach/clients');
  });

  it('writes the renewal, the failed payment, the lapse and the end for both people', () => {
    expect(renderEmail('coaching_renewed', athlete, 'https://x')!.text).toContain('₹4,500');
    expect(renderEmail('coaching_renewed', athlete, 'https://x')!.text).toContain('until 15 Dec');
    expect(renderEmail('renewal_failed', athlete, 'https://x')!.subject).toBe('Your payment for Online coaching did not go through');
    expect(renderEmail('renewal_failed', coach, 'https://x')!.subject).toBe('A payment from Kabir did not go through');
    expect(renderEmail('coaching_lapsed', athlete, 'https://x')!.subject).toBe('Your coaching with Vikram has ended');
    expect(renderEmail('coaching_lapsed', athlete, 'https://x')!.text).toContain('payment could not be taken');
    expect(renderEmail('coaching_ended', coach, 'https://x')!.subject).toBe('Coaching with Kabir has ended');
  });

  it('falls back to a neutral name, and every coaching template is sent', () => {
    expect(renderEmail('coaching_cancelled', { ...athlete, other: '' }, 'https://x')!.subject).toBe('Your coaching with your coach is cancelled');
    expect(renderEmail('coaching_ended', { ...coach, other: '' }, 'https://x')!.subject).toBe('Coaching with your client has ended');
    for (const t of ['coaching_cancelled', 'coaching_renewed', 'renewal_failed', 'coaching_lapsed', 'coaching_ended', 'coaching_stopped']) expect(TEMPLATES).toContain(t);
  });
});

describe('renderEmail for renewal by order (Decision 1)', () => {
  const due = { engagement: '7f000000-0000-0000-0000-0000000000e1', role: 'athlete', other: 'Vikram', package: 'Online coaching', paid_through: '2026-12-15', amount: 450000, days: 5 };
  it('reminds the athlete to pay for the next month, with the amount, the date and the pay link', () => {
    const e = renderEmail('renewal_due', due, 'https://x')!;
    expect(e.subject).toBe('Pay for your next month with Vikram');
    expect(e.text).toContain('Your coaching runs until 15 Dec.');
    expect(e.text).toContain('₹4,500');
    expect(e.text).toContain('https://x/coaching/7f000000-0000-0000-0000-0000000000e1/pay');
  });

  it('tells both people when an unpaid month ends the coaching', () => {
    expect(renderEmail('coaching_unpaid', due, 'https://x')!.subject).toBe('Your coaching with Vikram has ended');
    expect(renderEmail('coaching_unpaid', due, 'https://x')!.text).toContain('next month was not paid');
    expect(renderEmail('coaching_unpaid', { ...due, role: 'coach', other: 'Kabir' }, 'https://x')!.subject).toBe('Coaching with Kabir has ended');
    for (const t of ['renewal_due', 'coaching_unpaid']) expect(TEMPLATES).toContain(t);
  });
});

describe('renderEmail when a coach is suspended (M4-18)', () => {
  const data = { engagement: '8b000000-0000-0000-0000-0000000000e1', role: 'athlete', other: 'Vikram', package: 'Online coaching', paid_through: '2026-12-15', amount: 300000 };
  it('tells the athlete the coaching ended and the unused days come back, and tells the coach', () => {
    const a = renderEmail('coaching_suspended', data, 'https://x')!;
    expect(a.subject).toBe('Your coaching with Vikram has ended');
    expect(a.text).toContain('We refund the unused days of your paid month');
    expect(renderEmail('coaching_suspended', { ...data, role: 'coach', other: 'Kabir' }, 'https://x')!.subject).toBe('Coaching with Kabir has ended');
    expect(TEMPLATES).toContain('coaching_suspended');
  });
});

describe('renderEmail when a coach stops coaching (M4-19)', () => {
  it('tells the athlete the paid month runs out and nothing more is taken, and tells the coach', () => {
    const a = renderEmail('coaching_stopped', { role: 'athlete', other: 'Vikram', package: 'Online coaching', paid_through: '2026-12-15' }, 'https://x')!;
    expect(a.subject).toBe('Your coaching with Vikram will not renew');
    expect(a.text).toContain('You keep coaching until 15 Dec. No more payments are taken; if one goes through by mistake, it is refunded.');
    const c = renderEmail('coaching_stopped', { role: 'coach', other: 'Kabir', package: 'Online coaching', paid_through: '2026-12-15' }, 'https://x')!;
    expect(c.subject).toBe('Coaching with Kabir will not renew');
    expect(c.text).toContain('until 15 Dec');
    expect(c.text).toContain('https://x/account');
    expect(c.text).not.toContain('/coach/clients');
  });
});

describe('renderEmail for a refund (M4-12)', () => {
  it('tells the athlete the money is on its way and the coach that the payout is cancelled', () => {
    const a = renderEmail('coaching_refunded', { role: 'athlete', other: 'Vikram', package: 'Online coaching', amount: 450000 }, 'https://x')!;
    expect(a.subject).toBe('Your payment for Online coaching is refunded');
    expect(a.text).toContain('We refunded ₹4,500 for Online coaching with Vikram.');
    expect(a.text).toContain('5 to 7 working days');
    const c = renderEmail('coaching_refunded', { role: 'coach', other: 'Kabir', package: 'Online coaching', amount: 450000 }, 'https://x')!;
    expect(c.subject).toBe('Kabir was refunded for Online coaching');
    expect(c.text).toContain('no payout for it');
    expect(c.text).toContain('https://x/coach/clients');
    expect(TEMPLATES).toContain('coaching_refunded');
  });
});
