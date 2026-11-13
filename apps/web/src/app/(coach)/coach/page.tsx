import type { Metadata } from 'next';
import { Suspense } from 'react';
import { requireRole } from '@/lib/viewer';

export const metadata: Metadata = { title: 'Athletes · FitSphere Coach' };

async function Athletes() {
  await requireRole('coach');
  // shortcut: the coach dashboard (C-CoachDash) arrives in M3; this proves the shell and guard.
  return (
    <main className="mx-auto flex max-w-[1440px] flex-col gap-4 px-4 py-10 md:px-10">
      <h1 className="m-0 font-display text-[48px] font-normal uppercase leading-[0.95] md:text-[64px]">Athletes</h1>
      <p className="m-0 text-[16px] text-ink-soft">Your athletes will show here.</p>
    </main>
  );
}

export default function CoachHomePage() {
  return (
    <Suspense fallback={null}>
      <Athletes />
    </Suspense>
  );
}
