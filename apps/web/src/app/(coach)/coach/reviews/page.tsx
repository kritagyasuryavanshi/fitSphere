import { Button } from '@fitsphere/ui';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { supabaseServer } from '@/lib/supabase/server';
import { requireRole } from '@/lib/viewer';
import { replyReview } from './actions';

export const metadata: Metadata = { title: 'Reviews · FitSphere Coach' };

const when = (iso: string) => new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(iso));

// The coach's reviews, newest first (M4-14). A coach replies once, in public, and cannot edit or remove a review.
// The author shows as on the public profile: first name and last initial.
async function Reviews({ searchParams }: PageProps<'/coach/reviews'>) {
  await requireRole('coach');
  const { error } = await searchParams;
  const supabase = await supabaseServer();
  // Every review of this coach's coaching, hidden ones too, with the author as the public sees them.
  const mine = await supabase.rpc('my_reviews');
  if (mine.error) throw mine.error;
  if (!mine.data.length) return <p className="m-0 text-[16px]">No reviews yet. Clients can review once a paid month or session has finished.</p>;
  return (
    <>
      {error ? (
        <p role="alert" className="m-0 text-[15px] font-medium text-danger">
          {error === 'reply' ? 'Write a reply, up to 1,000 characters.' : 'We could not post your reply. Try again.'}
        </p>
      ) : null}
      <ul className="m-0 flex list-none flex-col gap-4 p-0">
        {mine.data.map((r) => (
          <li key={r.id} className="flex flex-col gap-2 border border-line p-5">
            <p className="m-0 text-[16px] font-semibold">
              {r.author} <span className="font-normal text-muted">· {r.rating} of 5 · {when(r.created_at)}</span>
            </p>
            {r.hidden_at ? <p className="m-0 text-[14px] text-muted">Hidden by FitSphere. It does not show or count.</p> : null}
            <p className="m-0 text-[16px] leading-[1.6]">{r.body}</p>
            {r.coach_reply ? (
              <p className="m-0 border-l-2 border-line-strong pl-3 text-[15px] text-ink-soft">
                <span className="font-medium text-ink">Your reply:</span> {r.coach_reply}
              </p>
            ) : r.hidden_at ? null : (
              <form action={replyReview} className="flex flex-col gap-3">
                <input type="hidden" name="review" value={r.id} />
                <label className="flex flex-col gap-2 text-[15px] font-medium">
                  Reply in public
                  <textarea name="reply" required maxLength={1000} rows={3} className="border border-line-strong bg-paper p-3 text-[16px] font-normal" />
                  <span className="text-[14px] font-normal text-muted">You can reply once, and the reply cannot be changed.</span>
                </label>
                <Button type="submit" size="small" className="self-start">
                  Post reply
                </Button>
              </form>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}

export default function CoachReviewsPage(props: PageProps<'/coach/reviews'>) {
  return (
    <main className="mx-auto flex w-full max-w-[880px] flex-col gap-6 px-4 pb-24 pt-8 md:px-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="m-0 font-display text-[48px] font-normal uppercase leading-[0.95]">Reviews</h1>
        <Link href="/coach/clients" className="text-[15px] font-medium underline underline-offset-4">
          Clients
        </Link>
      </div>
      <Suspense fallback={null}>
        <Reviews {...props} />
      </Suspense>
    </main>
  );
}
