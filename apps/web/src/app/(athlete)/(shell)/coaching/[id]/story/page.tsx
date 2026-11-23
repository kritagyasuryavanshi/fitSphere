import { Button } from '@fitsphere/ui';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { isUuid } from '@/lib/programs';
import { supabaseServer } from '@/lib/supabase/server';
import { requireRole } from '@/lib/viewer';
import { decideStory } from './actions';

export const metadata: Metadata = { title: 'Your story · FitSphere' };

const done: Record<string, string> = {
  approve: 'Approved. It now shows on your coach’s profile, with your first name and last initial.',
  photos: 'Photos approved. They show with the story.',
  withdraw: 'Withdrawn. The story no longer shows anywhere.',
};

// M4-15: the client reads the exact words (and photos) their coach wrote, and decides. Each approval is for this
// version only; photos need their own approval. Withdrawing hides the story at once.
async function Story({ params, searchParams }: PageProps<'/coaching/[id]/story'>) {
  const viewer = await requireRole('athlete');
  const { id } = await params;
  const { error: err, done: ok } = await searchParams;
  if (!isUuid(id)) notFound();
  const supabase = await supabaseServer();
  const { data: g, error } = await supabase
    .from('engagements')
    .select('id, package_title, stories(id, current_rev, approved_rev, photos_approved_rev, withdrawn_at, story_revisions(rev, body, photo_keys))')
    .eq('id', id)
    .eq('athlete_id', viewer.userId)
    .maybeSingle();
  if (error) throw error;
  const st = g?.stories;
  if (!g || !st) notFound();
  const current = st.story_revisions.find((r) => r.rev === st.current_rev)!;
  const photos = current.photo_keys.length
    ? await supabase.storage.from('story-photos').createSignedUrls(current.photo_keys, 300)
    : { data: [], error: null };
  if (photos.error) throw photos.error;
  const approvedThis = st.approved_rev === st.current_rev && !st.withdrawn_at;
  const photosApproved = approvedThis && st.photos_approved_rev === st.approved_rev;
  const hidden = (step: string) => (
    <>
      <input type="hidden" name="engagement" value={g.id} />
      <input type="hidden" name="story" value={st.id} />
      <input type="hidden" name="rev" value={st.current_rev} />
      <input type="hidden" name="step" value={step} />
    </>
  );

  return (
    <>
      <h1 className="m-0 font-display text-[48px] font-normal uppercase leading-[0.95]">Your story</h1>
      <p className="m-0 text-[16px] text-ink-soft">Your coach wrote this about your coaching ({g.package_title}). Nothing shows in public unless you approve it.</p>
      {typeof ok === 'string' && done[ok] ? (
        <p role="status" className="m-0 text-[15px] font-medium text-success">
          {done[ok]}
        </p>
      ) : err === 'changed' ? (
        <p role="alert" className="m-0 text-[15px] font-medium text-danger">
          Your coach changed the story. Read the new version below before you approve it.
        </p>
      ) : err ? (
        <p role="alert" className="m-0 text-[15px] font-medium text-danger">
          That did not save. Try again.
        </p>
      ) : null}
      <blockquote className="m-0 border-l-4 border-volt bg-mist p-4 text-[17px] leading-[1.6]">{current.body}</blockquote>
      {photos.data.length ? (
        <div className="flex flex-wrap gap-3">
          {photos.data.map((p, n) =>
            p.signedUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- a short-lived signed link, not an optimisable asset
              <img key={p.path} src={p.signedUrl} alt={`Photo ${n + 1} your coach added`} className="h-40 w-40 object-cover" />
            ) : null,
          )}
        </div>
      ) : null}
      <p className="m-0 text-[15px] font-medium">
        {st.withdrawn_at ? 'You withdrew this story. It is not shown.' : approvedThis ? `Approved and public${photosApproved ? ', with photos' : ''}.` : 'Not approved yet.'}
      </p>
      <div className="flex flex-wrap gap-3">
        {!approvedThis ? (
          <form action={decideStory}>
            {hidden('approve')}
            <Button type="submit">Approve these words</Button>
          </form>
        ) : null}
        {approvedThis && current.photo_keys.length && !photosApproved ? (
          <form action={decideStory}>
            {hidden('photos')}
            <Button type="submit" variant="light">
              Also show the photos
            </Button>
          </form>
        ) : null}
        {st.approved_rev && !st.withdrawn_at ? (
          <form action={decideStory}>
            {hidden('withdraw')}
            <Button type="submit" variant="danger">
              Withdraw my approval
            </Button>
          </form>
        ) : null}
      </div>
      <Link href="/coaching" className="text-[15px] font-medium underline underline-offset-4">
        Back to your coaching
      </Link>
    </>
  );
}

export default function StoryPage(props: PageProps<'/coaching/[id]/story'>) {
  return (
    <main className="mx-auto flex w-full max-w-[720px] flex-col gap-4 px-4 pb-24 pt-8 md:px-10">
      <Suspense fallback={null}>
        <Story {...props} />
      </Suspense>
    </main>
  );
}
