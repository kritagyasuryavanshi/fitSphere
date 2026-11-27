import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { progressView } from '@/lib/sports';
import { supabaseServer } from '@/lib/supabase/server';
import { requireRole } from '@/lib/viewer';
import { ProgressView } from './progress-view';

export const metadata: Metadata = { title: 'Progress · FitSphere' };

// C-Progress: boxing and S&C. A gym-only athlete opens on gym progress; the tab adds ?view=training to stay here.
async function Training({ searchParams }: { searchParams: PageProps<'/progress'>['searchParams'] }) {
  const viewer = await requireRole('athlete');
  if ((await searchParams).view !== 'training') {
    const prefs = await (await supabaseServer()).from('athlete_prefs').select('category_id').eq('user_id', viewer.userId);
    if (prefs.error) throw prefs.error;
    if (progressView(prefs.data.map((p) => p.category_id)) === 'gym') redirect('/progress/gym');
  }
  return <ProgressView sport="training" userId={viewer.userId} />;
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
