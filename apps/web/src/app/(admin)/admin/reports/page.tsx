import { Button } from '@fitsphere/ui';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { isUuid } from '@/lib/programs';
import { supabaseServer } from '@/lib/supabase/server';
import { requireRole } from '@/lib/viewer';
import { hideReview, resolveReport, suspendCoach } from './actions';

export const metadata: Metadata = { title: 'Reports · FitSphere Admin' };

const REASON: Record<string, string> = {
  harassment: 'Harassment or abuse',
  spam: 'Spam',
  unsafe_advice: 'Unsafe training advice',
  fake: 'Fake or misleading',
  off_platform_payment: 'Asked to pay outside FitSphere',
  other: 'Something else',
};
const DONE: Record<string, string> = {
  dismissed: 'Report dismissed.',
  resolved: 'Report resolved.',
  hidden: 'Review hidden. It no longer shows or counts in the rating.',
  suspended: 'Coach suspended. Their coaching ended today; the unused days are refunded by the daily job.',
};
const day = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' });

// R-Reports (M4-18). Open reports, oldest first. A reported message opens with up to 5 messages on each side; each
// opening is logged. Hiding a review or suspending a coach also resolves its reports.
async function Reports({ searchParams }: { searchParams: PageProps<'/admin/reports'>['searchParams'] }) {
  await requireRole('admin');
  const { context, done, error: err } = await searchParams;
  const supabase = await supabaseServer();
  const [reports, money] = await Promise.all([supabase.rpc('admin_reports'), supabase.rpc('admin_money_issues')]);
  if (reports.error) throw reports.error;
  if (money.error) throw money.error;
  const ctx = typeof context === 'string' && isUuid(context) ? await supabase.rpc('admin_report_context', { report: context }) : null;
  if (ctx?.error) throw ctx.error;

  return (
    <>
      {typeof done === 'string' && DONE[done] ? (
        <p role="status" className="m-0 text-[15px] font-medium text-success">
          {DONE[done]}
        </p>
      ) : err ? (
        <p role="alert" className="m-0 text-[15px] font-medium text-danger">
          That did not save. Try again.
        </p>
      ) : null}
      <section aria-labelledby="open" className="flex flex-col gap-3">
        <h2 id="open" className="m-0 text-[22px] font-medium">
          Open reports · {reports.data.length}
        </h2>
        {reports.data.length ? null : <p className="m-0 bg-mist p-6 text-[16px] text-ink-soft">No open reports.</p>}
        {reports.data.map((r) => (
          <article key={r.id} aria-label={`Report about a ${r.target_kind}`} className="flex flex-col gap-3 border border-line-strong p-4">
            <div className="flex flex-col gap-1">
              <span className="text-[16px] font-medium">
                {r.target_kind === 'review' ? 'A review' : r.target_kind === 'coach' ? 'A coach' : 'A message'} · {REASON[r.reason] ?? r.reason}
              </span>
              <span className="text-[14px] text-muted">{day.format(new Date(r.created_at))}</span>
              {r.summary ? <span className="text-[15px] text-ink-soft">{r.summary}</span> : null}
              {r.note ? <span className="text-[15px]">Reporter’s note: {r.note}</span> : null}
            </div>
            {r.target_kind === 'message' ? (
              <Link href={`/admin/reports?context=${r.id}`} className="self-start text-[15px] font-medium underline underline-offset-4">
                Read the message and the 5 on each side (logged)
              </Link>
            ) : null}
            {ctx && context === r.id ? (
              <ol aria-label="Reported message in context" className="m-0 flex list-none flex-col gap-2 p-0">
                {ctx.data.map((m) => (
                  <li key={m.message_id} className={`flex flex-col border p-3 ${m.reported ? 'border-danger' : 'border-line'}`}>
                    <span className="text-[13px] text-muted">
                      {m.sender_name} · {day.format(new Date(m.created_at))}
                      {m.reported ? ' · reported' : ''}
                    </span>
                    <span className="whitespace-pre-line text-[15px]">{m.body}</span>
                  </li>
                ))}
              </ol>
            ) : null}
            <div className="flex flex-wrap items-end gap-3">
              {r.target_kind === 'review' ? (
                <form action={hideReview}>
                  <input type="hidden" name="review" value={r.target_id} />
                  <Button type="submit" size="small" variant="danger">
                    Hide the review
                  </Button>
                </form>
              ) : null}
              {r.target_kind === 'coach' ? (
                <form action={suspendCoach} className="flex flex-wrap items-end gap-2">
                  <input type="hidden" name="coach" value={r.target_id} />
                  <div className="flex flex-col gap-1">
                    <label htmlFor={`why-${r.id}`} className="text-[14px] font-medium">
                      Reason for the suspension
                    </label>
                    <input id={`why-${r.id}`} name="why" required maxLength={500} className="min-h-11 border border-line-strong px-3 text-[16px]" />
                  </div>
                  <Button type="submit" size="small" variant="danger">
                    Suspend the coach
                  </Button>
                </form>
              ) : null}
              {(['resolved', 'dismissed'] as const).map((outcome) => (
                <form key={outcome} action={resolveReport}>
                  <input type="hidden" name="report" value={r.id} />
                  <input type="hidden" name="outcome" value={outcome} />
                  <Button type="submit" size="small" variant="light">
                    {outcome === 'resolved' ? 'Mark resolved' : 'Dismiss'}
                  </Button>
                </form>
              ))}
            </div>
          </article>
        ))}
      </section>
      <section aria-labelledby="money" className="flex flex-col gap-3">
        <h2 id="money" className="m-0 text-[22px] font-medium">
          Money checks · {money.data.length}
        </h2>
        {money.data.length ? (
          <ul className="m-0 flex list-none flex-col gap-1 p-0 text-[15px]">
            {money.data.map((m, i) => (
              <li key={`${m.rule}-${m.ref ?? i}`}>
                {m.rule}
                {m.ref ? <span className="text-muted"> · {m.ref}</span> : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="m-0 text-[15px] text-muted">Every money rule holds.</p>
        )}
      </section>
    </>
  );
}

export default function ReportsPage({ searchParams }: PageProps<'/admin/reports'>) {
  return (
    <main className="mx-auto flex max-w-[1080px] flex-col gap-6 px-4 py-10 md:px-10">
      <h1 className="m-0 font-display text-[48px] font-normal uppercase leading-[0.95] md:text-[64px]">Reports</h1>
      <p className="m-0 text-[16px] text-ink-soft">What people reported, and the money checks. Every action here is logged.</p>
      <Suspense fallback={null}>
        <Reports searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
