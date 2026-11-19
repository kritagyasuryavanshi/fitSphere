import { describe, expect, it, vi } from 'vitest';
import { drainOutbox, renderEmail, type OutboxRow } from './email';

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
      unsent: async (limit: number) => rows.filter((r) => !marked.includes(r.id)).slice(0, limit),
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
    expect(send).toHaveBeenNthCalledWith(1, expect.objectContaining({ to: 'neha@t.test', subject: 'Vikram sent you feedback' }));
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

  it('leaves an email with an unknown template queued, unsent, for a sender that knows it', async () => {
    const { db, marked } = fakeDb([row(1, 'neha@t.test', { template: 'no_such_template' }), row(2, 'ravi@t.test')]);
    const send = vi.fn(async () => {});
    expect(await drainOutbox(db, send)).toEqual({ sent: 1, failed: 0, skipped: 1 });
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
