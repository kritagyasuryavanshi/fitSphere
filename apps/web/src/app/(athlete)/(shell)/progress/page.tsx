import type { Metadata } from 'next';
import { Suspense } from 'react';
import { requireRole } from '@/lib/viewer';
import { ProgressView } from './progress-view';

export const metadata: Metadata = { title: 'Progress · FitSphere' };

// C-Progress: boxing and S&C.
async function Training() {
  const viewer = await requireRole('athlete');
  return <ProgressView sport="training" userId={viewer.userId} />;
}

export default function ProgressPage() {
  return (
    <main className="mx-auto flex w-full max-w-[1200px] flex-col gap-6 px-4 pb-24 pt-8 md:px-10">
      <Suspense fallback={null}>
        <Training />
      </Suspense>
    </main>
  );
}
