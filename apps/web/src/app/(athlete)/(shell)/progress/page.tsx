import type { Metadata } from 'next';
import { Suspense } from 'react';
import { requireRole } from '@/lib/viewer';
import { ProgressView } from './progress-view';

export const metadata: Metadata = { title: 'Progress · FitSphere' };

// C-Progress: boxing and S&C. The tab adds ?view=training, so a chosen tab always stays put.
async function Training({ searchParams }: { searchParams: PageProps<'/progress'>['searchParams'] }) {
  const viewer = await requireRole('athlete');
  return <ProgressView sport="training" userId={viewer.userId} stay={(await searchParams).view === 'training'} />;
}

export default function ProgressPage({ searchParams }: PageProps<'/progress'>) {
  return (
    <main className="mx-auto flex w-full max-w-[1200px] flex-col gap-6 px-4 pb-24 pt-8 md:px-10">
      <Suspense fallback={null}>
        <Training searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
