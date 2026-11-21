import { Button, buttonClass } from '@fitsphere/ui';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { shortDate } from '@/lib/dates';
import { isUuid } from '@/lib/programs';
import { supabaseServer } from '@/lib/supabase/server';
import { requireRole } from '@/lib/viewer';
import { cancelCoaching } from '../../actions';

export const metadata: Metadata = { title: 'Cancel coaching? · FitSphere' };

async function Confirm({ params, searchParams }: PageProps<'/coaching/[id]/cancel'>) {
  const viewer = await requireRole('athlete');
  const { id } = await params;
  const { error } = await searchParams;
  if (!isUuid(id)) notFound();
  const supabase = await supabaseServer();
  const { data: g, error: readError } = await supabase
    .from('engagements')
    .select('id, coach_id, package_kind, status, paid_through')
    .eq('id', id)
    .eq('athlete_id', viewer.userId)
    .maybeSingle();
  if (readError) throw readError;
  if (!g || g.status !== 'active' || g.package_kind !== 'monthly' || !g.paid_through) notFound();
  const { data: name } = g.coach_id ? await supabase.rpc('coach_public_name', { coach: g.coach_id }) : { data: null };
  const coach = name || 'your coach';
  const until = shortDate(g.paid_through);
  return (
    <section role="alertdialog" aria-modal="true" aria-labelledby="dlg-title" className="flex flex-col gap-5 border border-line-strong p-6">
      <h1 id="dlg-title" className="m-0 font-display text-[40px] font-normal uppercase leading-[0.95]">
        Cancel coaching with {coach}?
      </h1>
      <ul className="m-0 flex flex-col gap-2 pl-5 text-[16px] leading-[1.6] text-ink-soft">
        <li>
          You keep coaching until <strong>{until}</strong>, the end of the month you paid for.
        </li>
        <li>No more payments are taken. Refunds are only for a first payment, within 7 days; renewals are not refunded.</li>
        <li>After {until}, {coach} stops seeing your logs. Past feedback stays with you.</li>
      </ul>
      {error ? (
        <p role="alert" className="m-0 text-[15px] font-medium text-danger">
          We could not cancel your coaching. Try again.
        </p>
      ) : null}
      <form action={cancelCoaching} className="flex flex-col gap-5">
        <input type="hidden" name="engagement" value={id} />
        <label className="flex flex-col gap-2 text-[15px] font-medium">
          <span>
            Why are you leaving? <span className="font-normal text-muted">Optional, {coach} does not see this</span>
          </span>
          <select name="reason" defaultValue="" className="min-h-12 border border-line-strong bg-paper px-3 text-[16px] font-normal">
            <option value="">Choose a reason</option>
            <option value="too_expensive">Too expensive</option>
            <option value="not_right_fit">Not the right fit</option>
            <option value="taking_break">Taking a break</option>
            <option value="injury">Injury or health</option>
            <option value="other">Other</option>
          </select>
        </label>
        <div className="flex flex-wrap gap-3">
          <Button type="submit" variant="danger">
            Cancel coaching
          </Button>
          <Link href="/coaching" className={buttonClass({ variant: 'light' })}>
            Keep coaching
          </Link>
        </div>
      </form>
    </section>
  );
}

// X-CancelCoaching: cancelling needs this screen; the button lives only here.
export default function CancelPage(props: PageProps<'/coaching/[id]/cancel'>) {
  return (
    <main className="mx-auto flex max-w-xl flex-col px-4 py-16">
      <Suspense fallback={null}>
        <Confirm {...props} />
      </Suspense>
    </main>
  );
}
