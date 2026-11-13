import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { authorNames, humanise, levelLabel } from '@/lib/content';
import { db } from '@/lib/db';

export const metadata: Metadata = { title: 'Search · FitSphere' };

const types = [
  { id: 'all', label: 'All' },
  { id: 'skill', label: 'Lessons' },
  { id: 'drill', label: 'Drills' },
  { id: 'exercise', label: 'Exercises' },
] as const;

function one(v: string | string[] | undefined) {
  return (Array.isArray(v) ? v[0] : v)?.trim().slice(0, 200) ?? '';
}

async function Results({ searchParams }: PageProps<'/search'>) {
  const params = await searchParams;
  const q = one(params.q);
  const type = types.some((t) => t.id === one(params.type)) ? one(params.type) : 'all';
  if (!q) return <p className="m-0 mt-8 text-[16px] text-muted">Type a skill, drill or exercise, like jab or squat.</p>;

  const supabase = db();
  const { data, error } = await supabase.rpc('search_content', { q });
  if (error) throw error;
  const names = await authorNames(data.map((r) => r.author_id));
  const shown = type === 'all' ? data : data.filter((r) => r.kind === type);
  const href = (t: string) => `/search?${new URLSearchParams(t === 'all' ? { q } : { q, type: t })}`;

  return (
    <>
      <nav aria-label="Result types" className="mt-6 flex flex-wrap gap-2">
        {types.map((t) => {
          const count = t.id === 'all' ? data.length : data.filter((r) => r.kind === t.id).length;
          const current = t.id === type;
          return (
            <Link
              key={t.id}
              href={href(t.id)}
              aria-current={current ? 'page' : undefined}
              className={`inline-flex min-h-11 items-center gap-2 rounded-pill px-5 text-[16px] font-medium ${current ? 'bg-ink text-paper' : 'border border-line-strong'}`}
            >
              {t.label} <span className={current ? 'text-faint' : 'text-muted'}>{count}</span>
            </Link>
          );
        })}
      </nav>
      <p className="m-0 mt-6 text-[16px] font-medium" role="status">
        {shown.length} {shown.length === 1 ? 'result' : 'results'} for “{q}”
      </p>
      <ul aria-label="Results" className="m-0 mt-2 flex list-none flex-col p-0">
        {shown.map((r) => {
          const what = r.kind === 'skill' ? 'Skill lesson' : humanise(r.kind);
          const meta = [levelLabel(r.category_id, r.level), r.duration_min ? `${r.duration_min} min` : null, r.author_id ? names.get(r.author_id) : null].filter(Boolean).join(' · ');
          return (
            <li key={r.slug} className="border-b border-line">
              <Link href={`/learn/${r.category_id}/${r.slug}`} className="flex flex-col gap-1 py-4">
                <span className="text-[13px] font-semibold text-muted">
                  {what}
                  {r.supports[0] ? ` · Builds ${humanise(r.supports[0]).toLowerCase()}` : ''} ·{' '}
                  <span className={r.is_sample ? 'text-warning' : ''}>{r.is_sample ? 'Sample' : 'Coach-verified'}</span>
                </span>
                <span className="text-[18px] font-medium">{r.title}</span>
                <span className="text-[15px] text-muted">{meta}</span>
              </Link>
            </li>
          );
        })}
      </ul>
      {!shown.length ? <p className="m-0 mt-4 text-[16px] text-muted">Try a shorter word, or browse the library.</p> : null}
    </>
  );
}

async function SearchBox({ searchParams }: PageProps<'/search'>) {
  const q = one((await searchParams).q);
  return (
    <form method="get" role="search" className="mt-6 flex gap-2">
      <label htmlFor="q" className="sr-only">
        Search lessons, drills and exercises
      </label>
      <input
        id="q"
        name="q"
        type="search"
        defaultValue={q}
        maxLength={200}
        placeholder="Search lessons, drills and exercises"
        className="min-h-12 min-w-0 flex-1 rounded-pill border border-line-strong px-5 text-[16px]"
      />
      <button type="submit" className="min-h-12 rounded-pill bg-ink px-6 text-[16px] font-medium text-paper">
        Search
      </button>
    </form>
  );
}

export default function SearchPage(props: PageProps<'/search'>) {
  return (
    <main className="mx-auto w-full max-w-[900px] px-4 pb-20 pt-8 md:px-10">
      <h1 className="m-0 font-display text-[48px] font-normal uppercase leading-[0.95] md:text-[64px]">Search</h1>
      <Suspense fallback={null}>
        <SearchBox {...props} />
        <Results {...props} />
      </Suspense>
    </main>
  );
}
