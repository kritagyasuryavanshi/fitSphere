import { Button } from '@fitsphere/ui';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { isUuid } from '@/lib/programs';
import { supabaseServer } from '@/lib/supabase/server';
import { requireRole } from '@/lib/viewer';
import { postReview } from '../../actions';
import { Stars } from './stars';

export const metadata: Metadata = { title: 'Review your coach · FitSphere' };

const ASPECTS: [string, string][] = [
  ['technique', 'Technique teaching'],
  ['feedback_speed', 'Feedback speed'],
  ['value_for_money', 'Value for money'],
];
const LEVELS: [string, string][] = [
  ['excellent', 'Excellent'],
  ['good', 'Good'],
  ['okay', 'Okay'],
];
const ERRORS: Record<string, string> = {
  rating: 'Choose an overall rating.',
  body: 'Write a few words about your coaching, up to 1,000 characters.',
  failed: 'We could not post your review. Try again.',
};

async function Review({ params, searchParams }: PageProps<'/coaching/[id]/review'>) {
  const viewer = await requireRole('athlete');
  const { id } = await params;
  const { error } = await searchParams;
  if (!isUuid(id)) notFound();
  const supabase = await supabaseServer();
  const [g, allowed] = await Promise.all([
    supabase.from('engagements').select('coach_id, package_title, package_kind, orders(status)').eq('id', id).eq('athlete_id', viewer.userId).maybeSingle(),
    supabase.rpc('can_review', { engagement: id }),
  ]);
  if (g.error) throw g.error;
  if (allowed.error) throw allowed.error;
  // The database decides: only coaching with a finished paid period, reviewed once.
  if (!g.data?.coach_id || !allowed.data) notFound();
  const { data: name } = await supabase.rpc('coach_public_name', { coach: g.data.coach_id });
  const coach = name || 'your coach';
  const months = g.data.orders.filter((o) => o.status === 'paid').length;
  const message = typeof error === 'string' ? ERRORS[error] : undefined;
  return (
    <form action={postReview} aria-labelledby="review-title" className="flex flex-col gap-6">
      <input type="hidden" name="engagement" value={id} />
      <p className="m-0 inline-flex items-center gap-1.5 text-[13px] font-semibold text-success">
        Verified client · {g.data.package_title} · {g.data.package_kind === 'single' ? 'a session' : `${months} ${months === 1 ? 'month' : 'months'}`}
      </p>
      <h1 id="review-title" className="m-0 font-display text-[48px] font-normal uppercase leading-[0.95]">
        Review {coach}
      </h1>
      <Stars name="rating" />
      {ASPECTS.map(([key, label]) => (
        <fieldset key={key} className="m-0 flex flex-wrap items-center gap-3 border-0 p-0">
          <legend className="float-left mr-3 min-w-40 text-[16px] font-medium">{label}</legend>
          {LEVELS.map(([value, text]) => (
            <label
              key={value}
              className="relative inline-flex min-h-11 cursor-pointer items-center rounded-full border border-line-strong px-4 text-[15px] has-checked:border-ink has-checked:bg-ink has-checked:text-paper has-focus-visible:outline-2 has-focus-visible:outline-ink"
            >
              <input type="radio" name={key} value={value} className="sr-only" />
              {text}
            </label>
          ))}
        </fieldset>
      ))}
      <label className="flex flex-col gap-2 text-[16px] font-medium">
        Your review
        <textarea name="body" required maxLength={1000} rows={5} className="border border-line-strong bg-paper p-3 text-[16px] font-normal" />
        <span className="text-[14px] font-normal text-muted">Shown with your first name and last initial. No health details.</span>
      </label>
      {message ? (
        <p role="alert" className="m-0 text-[15px] font-medium text-danger">
          {message}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center gap-4">
        <Button type="submit">Post review</Button>
        <span className="text-[14px] text-muted">{coach} can reply publicly but cannot edit or remove it.</span>
      </div>
    </form>
  );
}

// X-Review: a verified client reviews their coach (M4-14).
export default function ReviewPage(props: PageProps<'/coaching/[id]/review'>) {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-col px-4 pb-24 pt-8">
      <Suspense fallback={null}>
        <Review {...props} />
      </Suspense>
    </main>
  );
}
