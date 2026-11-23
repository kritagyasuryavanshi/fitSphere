import { formatInr } from '@fitsphere/core';
import { Button } from '@fitsphere/ui';
import type { Metadata } from 'next';
import { Suspense } from 'react';
import { supabaseServer } from '@/lib/supabase/server';
import { requireRole } from '@/lib/viewer';
import { markPayoutFailed, markPayoutPaid } from './actions';

export const metadata: Metadata = { title: 'Payouts · FitSphere Admin' };

const day = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' });
const errors: Record<string, string> = {
  reference_required: 'Enter the bank reference (UTR) of the transfer.',
  on_hold: 'This payout is still in its hold.',
  refund_open: 'A refund was asked for this payment, so it cannot be paid out.',
  not_due: 'This payout is not due any more. The list is up to date now.',
  note_required: 'Say why the transfer failed.',
  not_paid: 'This payout is not marked paid.',
  failed: 'That did not save. Try again.',
};

// M4-13 phase a: manual payouts until Razorpay Route. Pay each one by bank transfer, then record its reference here.
async function Payouts({ searchParams }: { searchParams: PageProps<'/admin/payouts'>['searchParams'] }) {
  await requireRole('admin');
  const { error: err, done } = await searchParams;
  const supabase = await supabaseServer();
  const [due, paid] = await Promise.all([
    supabase.rpc('admin_payouts_due'),
    supabase.from('payouts').select('id, net_paise, paid_at, paid_ref').eq('status', 'manual_paid').order('paid_at', { ascending: false }).limit(20),
  ]);
  if (due.error) throw due.error;
  if (paid.error) throw paid.error;
  return (
    <>
      {typeof err === 'string' ? (
        <p role="alert" className="m-0 text-[15px] font-medium text-danger">
          {errors[err] ?? errors.failed}
        </p>
      ) : done === 'paid' ? (
        <p role="status" className="m-0 text-[15px] font-medium text-success">
          Recorded as paid.
        </p>
      ) : done === 'failed' ? (
        <p role="status" className="m-0 text-[15px] font-medium text-success">
          Back in the list to pay.
        </p>
      ) : null}
      <section aria-labelledby="due" className="flex flex-col gap-3">
        <h2 id="due" className="m-0 text-[22px] font-medium">
          Ready to pay · {due.data.length}
        </h2>
        {due.data.length ? null : <p className="m-0 bg-mist p-6 text-[16px] text-ink-soft">Nothing is ready. A payout is ready after its hold, if no refund was asked.</p>}
        {due.data.map((p) => (
          <article key={p.payout_id} aria-label={`Payout to ${p.coach_name}`} className="flex flex-col gap-3 border border-line-strong p-4 md:flex-row md:items-end md:justify-between">
            <div className="flex flex-col gap-1">
              <span className="text-[17px] font-medium">
                {p.coach_name} · {formatInr(p.net_paise)}
              </span>
              <span className="text-[14px] text-muted">Hold ended {day.format(new Date(p.hold_until))}</span>
              {p.failed_note ? <span className="text-[14px] text-warning">Last transfer failed: {p.failed_note}</span> : null}
            </div>
            <form action={markPayoutPaid} className="flex flex-wrap items-end gap-2">
              <input type="hidden" name="payout" value={p.payout_id} />
              <div className="flex flex-col gap-1">
                <label htmlFor={`ref-${p.payout_id}`} className="text-[14px] font-medium">
                  Bank reference (UTR)
                </label>
                <input id={`ref-${p.payout_id}`} name="reference" required maxLength={100} className="min-h-11 border border-line-strong px-3 text-[16px]" />
              </div>
              <Button type="submit" size="small">
                Mark paid
              </Button>
            </form>
          </article>
        ))}
      </section>
      <section aria-labelledby="paid" className="flex flex-col gap-3">
        <h2 id="paid" className="m-0 text-[22px] font-medium">
          Recently paid
        </h2>
        {paid.data.length ? null : <p className="m-0 text-[15px] text-muted">No payouts yet.</p>}
        {paid.data.map((p) => (
          <article key={p.id} aria-label={`Paid ${formatInr(p.net_paise)}`} className="flex flex-col gap-2 border border-line p-4 md:flex-row md:items-end md:justify-between">
            <span className="text-[15px]">
              {formatInr(p.net_paise)} · {p.paid_at ? day.format(new Date(p.paid_at)) : ''} · {p.paid_ref}
            </span>
            <form action={markPayoutFailed} className="flex flex-wrap items-end gap-2">
              <input type="hidden" name="payout" value={p.id} />
              <div className="flex flex-col gap-1">
                <label htmlFor={`note-${p.id}`} className="text-[14px] font-medium">
                  Why it failed
                </label>
                <input id={`note-${p.id}`} name="note" required maxLength={300} className="min-h-11 border border-line-strong px-3 text-[16px]" />
              </div>
              <Button type="submit" size="small" variant="light">
                Transfer failed
              </Button>
            </form>
          </article>
        ))}
      </section>
    </>
  );
}

export default function PayoutsPage({ searchParams }: PageProps<'/admin/payouts'>) {
  return (
    <main className="mx-auto flex max-w-[1080px] flex-col gap-6 px-4 py-10 md:px-10">
      <h1 className="m-0 font-display text-[48px] font-normal uppercase leading-[0.95] md:text-[64px]">Payouts</h1>
      <p className="m-0 text-[16px] text-ink-soft">Pay each coach by bank transfer, then record the reference. Every change is logged.</p>
      <Suspense fallback={null}>
        <Payouts searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
