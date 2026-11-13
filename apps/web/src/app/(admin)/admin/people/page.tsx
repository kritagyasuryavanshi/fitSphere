import type { Metadata } from 'next';
import { Suspense } from 'react';
import { requireRole } from '@/lib/viewer';

export const metadata: Metadata = { title: 'People · FitSphere Admin' };

async function People() {
  await requireRole('admin');
  // shortcut: the people and roles screen (R-Roles) is M1-06; this proves the shell and guard.
  return (
    <main className="mx-auto flex max-w-[1440px] flex-col gap-4 px-4 py-10 md:px-10">
      <h1 className="m-0 font-display text-[48px] font-normal uppercase leading-[0.95] md:text-[64px]">People</h1>
      <p className="m-0 text-[16px] text-ink-soft">People and their roles will show here.</p>
    </main>
  );
}

export default function PeoplePage() {
  return (
    <Suspense fallback={null}>
      <People />
    </Suspense>
  );
}
