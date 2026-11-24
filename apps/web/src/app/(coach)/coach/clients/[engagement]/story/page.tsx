import { Button } from '@fitsphere/ui';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { isUuid } from '@/lib/programs';
import { supabaseServer } from '@/lib/supabase/server';
import { requireRole } from '@/lib/viewer';
import { saveStory } from './actions';

export const metadata: Metadata = { title: 'Client story · FitSphere Coach' };

const errors: Record<string, string> = {
  not_paid: 'A story needs coaching the client has paid for.',
  bad_story: 'Write between 20 and 2,000 characters.',
  bad_photo: 'Use up to 3 JPG, PNG or WebP photos of 2 MB or less.',
  too_many: 'Use up to 3 photos.',
  upload: 'A photo did not upload. Try again.',
  failed: 'That did not save. Try again.',
};

// M4-15: the coach drafts a story about a client. It shows on the public profile only after the client approves the
// exact text, and photos only after a second approval. Every save is a new version the client sees.
async function Story({ params, searchParams }: PageProps<'/coach/clients/[engagement]/story'>) {
  const viewer = await requireRole('coach');
  const { engagement } = await params;
  const { error: err, saved } = await searchParams;
  if (!isUuid(engagement)) notFound();
  const supabase = await supabaseServer();
  const { data: g, error } = await supabase
    .from('engagements')
    .select('id, package_title, athlete_id, stories(id, current_rev, approved_rev, photos_approved_rev, withdrawn_at, story_revisions(rev, body, photo_keys))')
    .eq('id', engagement)
    .eq('coach_id', viewer.userId)
    .maybeSingle();
  if (error) throw error;
  if (!g || !g.athlete_id) notFound();
  const st = g.stories;
  const current = st?.story_revisions.find((r) => r.rev === st.current_rev);
  const status = !st
    ? null
    : st.withdrawn_at
      ? 'Withdrawn by the client. It is not shown.'
      : st.approved_rev === st.current_rev
        ? `Approved and public${st.photos_approved_rev === st.approved_rev && current?.photo_keys.length ? ', with photos' : ''}.`
        : st.approved_rev
          ? `Version ${st.approved_rev} is public. Version ${st.current_rev} waits for the client.`
          : 'Waiting for the client to approve.';

  return (
    <>
      <h1 className="m-0 font-display text-[48px] font-normal uppercase leading-[0.95]">Client story</h1>
      <p className="m-0 text-[16px] text-ink-soft">
        About your client on {g.package_title}. It shows on your profile only after they approve these exact words. Photos need their second, separate approval.
      </p>
      {typeof err === 'string' ? (
        <p role="alert" className="m-0 text-[15px] font-medium text-danger">
          {errors[err] ?? errors.failed}
        </p>
      ) : saved === '1' ? (
        <p role="status" className="m-0 text-[15px] font-medium text-success">
          Saved. Your client sees the new version and can approve it.
        </p>
      ) : null}
      {status ? <p className="m-0 text-[15px] font-medium">{status}</p> : null}
      <form action={saveStory} className="flex flex-col gap-4">
        <input type="hidden" name="engagement" value={g.id} />
        {current?.photo_keys.map((k) => <input key={k} type="hidden" name="keep" value={k} />)}
        <div className="flex flex-col gap-1">
          <label htmlFor="story-body" className="text-[15px] font-medium">
            The story
          </label>
          <textarea id="story-body" name="body" required minLength={20} maxLength={2000} rows={7} defaultValue={current?.body ?? ''} className="border border-line-strong p-3 text-[16px]" />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="story-photos" className="text-[15px] font-medium">
            Photos (optional, up to 3)
          </label>
          <input id="story-photos" name="photos" type="file" accept="image/jpeg,image/png,image/webp" multiple className="text-[15px]" />
          {current?.photo_keys.length ? <span className="text-[14px] text-muted">{current.photo_keys.length} photo(s) kept unless you choose new ones.</span> : null}
        </div>
        <Button type="submit" className="self-start">
          {st ? 'Save a new version' : 'Save and send to the client'}
        </Button>
      </form>
      <Link href="/coach/clients" className="text-[15px] font-medium underline underline-offset-4">
        Back to clients
      </Link>
    </>
  );
}

export default function StoryPage(props: PageProps<'/coach/clients/[engagement]/story'>) {
  return (
    <main className="mx-auto flex w-full max-w-[720px] flex-col gap-4 px-4 pb-24 pt-8 md:px-10">
      <Suspense fallback={null}>
        <Story {...props} />
      </Suspense>
    </main>
  );
}
