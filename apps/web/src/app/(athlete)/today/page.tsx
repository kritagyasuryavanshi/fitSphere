import type { Metadata } from 'next';
import { Suspense } from 'react';
import { requireRole } from '@/lib/viewer';

export const metadata: Metadata = { title: 'Today · FitSphere' };

async function Today() {
  const viewer = await requireRole('athlete');
  // shortcut: the real Today screen (C-Today, T-TodayEmpty) arrives with training in M3; this proves the shell and guard.
  return (
    <main className="mx-auto flex max-w-[1440px] flex-col gap-4 px-4 py-10 md:px-10">
      <h1 className="m-0 font-display text-[48px] font-normal uppercase leading-[0.95] md:text-[64px]">Today</h1>
      <p className="m-0 text-[16px] text-ink-soft">Welcome, {viewer.name}. Your sessions will show here.</p>
    </main>
  );
}

export default function TodayPage() {
  return (
    <Suspense fallback={null}>
      <Today />
    </Suspense>
  );
}
