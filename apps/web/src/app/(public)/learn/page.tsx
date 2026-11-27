import type { Metadata } from 'next';
import { connection } from 'next/server';
import { Suspense } from 'react';
import { SportPaths } from '@/components/sport-paths';
import { libraryItems } from '@/lib/content';
import { db } from '@/lib/db';

export const metadata: Metadata = { title: 'Learn · FitSphere', description: 'Coach-checked lessons for boxing, strength and conditioning, and the gym.' };

// The Learn hub: every live sport as an equal path, so no sport is the front door. Lesson emails fall back here.
async function Paths() {
  await connection();
  const { data, error } = await db().from('categories').select('id, name, tagline, is_live').order('sort');
  if (error) throw error;
  const live = data.filter((c) => c.is_live);
  const counts = await Promise.all(live.map((c) => libraryItems(c.id).then((items) => items.length)));
  return (
    <SportPaths
      paths={live.map((c, i) => ({ id: c.id, name: c.name, tagline: c.tagline, count: counts[i]! }))}
      planned={data.filter((c) => !c.is_live).map((c) => c.name)}
    />
  );
}

export default function LearnPage() {
  return (
    <main className="mx-auto flex w-full max-w-[1440px] flex-col gap-8 px-4 pb-20 pt-8 md:px-10">
      <div className="flex flex-col gap-3">
        <h1 className="m-0 font-display text-[clamp(56px,9vw,140px)] font-normal uppercase leading-[0.85]">Learn</h1>
        <p className="m-0 max-w-[60ch] text-[18px] leading-[1.5] text-ink-soft">Pick a path. Every lesson has steps, common mistakes and safety notes, and a second coach checks it before it goes live.</p>
      </div>
      <Suspense fallback={<div className="min-h-[240px]" />}>
        <Paths />
      </Suspense>
    </main>
  );
}
