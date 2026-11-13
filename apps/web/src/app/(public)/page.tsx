import { formatInr } from '@fitsphere/core';
import Link from 'next/link';
import { Suspense } from 'react';
import { getViewer } from '@/lib/viewer';

async function SessionLine() {
  // getViewer, not the raw token: a deleted account's token still checks out for up to an hour.
  const viewer = await getViewer();
  return viewer ? `Signed in as ${viewer.email}` : <Link href="/sign-in" className="underline">Log in or join</Link>;
}

// The account delete action lands here with ?deleted=1, so the person sees that it worked.
async function DeletedNotice({ searchParams }: { searchParams: PageProps<'/'>['searchParams'] }) {
  const { deleted } = await searchParams;
  return deleted === '1' ? (
    <p role="status" className="mt-4 border-l-4 border-success bg-success-soft px-4 py-3 text-[15px] font-medium">
      Your account and everything personal in it have been deleted.
    </p>
  ) : null;
}

// Temporary scaffold page. Replaced by the real landing page in board task M6-01.
export default function Home({ searchParams }: PageProps<'/'>) {
  return (
    <main className="mx-auto max-w-2xl p-10">
      <Suspense fallback={null}>
        <DeletedNotice searchParams={searchParams} />
      </Suspense>
      <h1 className="text-4xl font-semibold">FitSphere</h1>
      <p className="mt-4">App scaffold is running. Shared rules work: a monthly package costs {formatInr(450000)}.</p>
      <p className="mt-4">
        <Suspense fallback={null}>
          <SessionLine />
        </Suspense>
      </p>
    </main>
  );
}
