import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { humanise, levelLabel } from '@/lib/content';
import { supabaseServer } from '@/lib/supabase/server';
import { requireSignedIn } from '@/lib/viewer';

export const metadata: Metadata = { title: 'Saved · FitSphere' };

async function Saved({ searchParams }: PageProps<'/account/saved'>) {
  await requireSignedIn();
  const sport = (await searchParams).sport;
  const supabase = await supabaseServer();
  // RLS returns only the caller's rows, and only published items join.
  const item = 'slug, title, level, duration_min, supports, status, is_sample, disciplines!inner(category_id, categories(name))';
  const [saves, done] = await Promise.all([
    supabase.from('saves').select(`created_at, content_items!inner(${item})`).eq('content_items.status', 'published').order('created_at', { ascending: false }),
    supabase.from('completions').select('content_items!inner(slug)'),
  ]);
  if (saves.error) throw saves.error;
  const completed = new Set((done.data ?? []).map((d) => d.content_items.slug));
  const all = saves.data.map((s) => s.content_items);
  const sports = [...new Map(all.map((i) => [i.disciplines.category_id, i.disciplines.categories.name])).entries()];
  const shown = typeof sport === 'string' ? all.filter((i) => i.disciplines.category_id === sport) : all;

  if (!all.length) {
    return (
      <div className="flex flex-col items-start gap-3 bg-mist p-8">
        <p className="m-0 text-[18px] font-medium">Nothing saved yet.</p>
        <p className="m-0 text-[16px] text-muted">Tap Save on any lesson to keep it here.</p>
        <Link href="/learn" className="text-[16px] font-medium underline underline-offset-4">
          Browse the library
        </Link>
      </div>
    );
  }
  return (
    <>
      <nav aria-label="Sports" className="flex flex-wrap gap-2">
        {[['all', 'All', all.length] as const, ...sports.map(([id, name]) => [id, name, all.filter((i) => i.disciplines.category_id === id).length] as const)].map(([id, name, count]) => {
          const current = id === 'all' ? typeof sport !== 'string' : sport === id;
          return (
            <Link
              key={id}
              href={id === 'all' ? '/account/saved' : `/account/saved?sport=${id}`}
              aria-current={current ? 'page' : undefined}
              className={`inline-flex min-h-11 items-center gap-2 rounded-pill px-5 text-[16px] font-medium ${current ? 'bg-ink text-paper' : 'border border-line-strong'}`}
            >
              {name} {count}
            </Link>
          );
        })}
      </nav>
      <ul aria-label="Saved items" className="m-0 flex list-none flex-col p-0">
        {shown.map((i) => (
          <li key={i.slug} className="border-b border-line">
            <Link href={`/learn/${i.disciplines.category_id}/${i.slug}`} className="flex flex-col gap-1 py-4">
              <span className={`text-[13px] font-semibold ${completed.has(i.slug) ? 'text-success' : i.is_sample ? 'text-warning' : 'text-muted'}`}>
                {completed.has(i.slug) ? 'Completed' : i.supports[0] ? `Builds ${humanise(i.supports[0]).toLowerCase()}` : i.is_sample ? 'Sample' : 'Coach-verified'}
              </span>
              <span className="text-[18px] font-medium">{i.title}</span>
              <span className="text-[15px] text-muted">{[levelLabel(i.disciplines.category_id, i.level), i.duration_min ? `${i.duration_min} min` : null].filter(Boolean).join(' · ')}</span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}

export default function SavedPage(props: PageProps<'/account/saved'>) {
  return (
    <main className="mx-auto flex w-full max-w-[760px] flex-col gap-6 px-4 pb-20 pt-8 md:px-10">
      <h1 className="m-0 font-display text-[48px] font-normal uppercase leading-[0.95] md:text-[64px]">Saved</h1>
      <Suspense fallback={null}>
        <Saved {...props} />
      </Suspense>
    </main>
  );
}
