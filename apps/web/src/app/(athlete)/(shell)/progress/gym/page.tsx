import type { Metadata } from 'next';
import { Suspense } from 'react';
import { requireRole } from '@/lib/viewer';
import { ProgressView } from '../progress-view';

export const metadata: Metadata = { title: 'Gym progress · FitSphere' };

// G-Progress: gym, with hard sets per muscle and body weight.
async function Gym() {
  const viewer = await requireRole('athlete');
  return <ProgressView sport="gym" userId={viewer.userId} />;
}

export default function GymProgressPage() {
  return (
    <main className="mx-auto flex w-full max-w-[1200px] flex-col gap-6 px-4 pb-24 pt-8 md:px-10">
      <Suspense fallback={null}>
        <Gym />
      </Suspense>
    </main>
  );
}
