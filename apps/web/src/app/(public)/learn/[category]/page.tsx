import { Tag } from '@fitsphere/ui';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { facetKeys, humanise, itemNoun, type FacetKey, type Filters, legendFor, levelLabel, libraryItems, type LibraryItem, matches, parseFilters, valuesOf } from '@/lib/content';
import { db } from '@/lib/db';
import { FilterForm } from './filter-form';

async function liveCategory(id: string) {
  const supabase = db();
  const { data } = await supabase.from('categories').select('id, name, is_live').order('sort');
  const all = data ?? [];
  const current = all.find((c) => c.id === id && c.is_live);
  return current ? { current, all } : null;
}

export async function generateMetadata({ params }: PageProps<'/learn/[category]'>): Promise<Metadata> {
  const found = await liveCategory((await params).category);
  return { title: found ? `${found.current.name} library · FitSphere` : 'Not found · FitSphere' };
}

type Option = { value: string; label: string; count: number };

/** The values a filter offers, with real counts, in first-seen order. A filter with one value is left out. */
function options(category: string, items: LibraryItem[], key: FacetKey, disciplineNames: Map<string, string>): Option[] {
  const counts = new Map<string, number>();
  for (const item of items) for (const v of valuesOf(item, key)) counts.set(v, (counts.get(v) ?? 0) + 1);
  const label = (v: string) => (key === 'discipline' ? (disciplineNames.get(v) ?? humanise(v)) : key === 'level' ? levelLabel(category, v) : humanise(v));
  const list = [...counts].map(([value, count]) => ({ value, label: label(value), count }));
  return list.length > 1 ? list : [];
}

function hrefWithout(category: string, filters: Filters, key: FacetKey, value: string) {
  const q = new URLSearchParams();
  for (const k of facetKeys) for (const v of filters[k] ?? []) if (!(k === key && v === value)) q.append(k, v);
  const s = q.toString();
  return `/learn/${category}${s ? `?${s}` : ''}`;
}

function Facets({ category, items, filters, names }: { category: string; items: LibraryItem[]; filters: Filters; names: Map<string, string> }) {
  return (
    <FilterForm>
      {facetKeys.map((key) => {
        const list = options(category, items, key, names);
        if (!list.length) return null;
        return (
          <fieldset key={key} className="m-0 border-0 border-b border-line p-0 py-5 first:pt-0">
            <legend className="float-left w-full pb-3 text-[16px] font-medium">{legendFor(category, key)}</legend>
            {list.map((o) => (
              <label key={o.value} className="clear-left flex min-h-11 items-center gap-2.5 text-[15px]">
                <input type="checkbox" name={key} value={o.value} defaultChecked={filters[key]?.includes(o.value)} className="size-[18px] accent-ink" />
                {o.label}
                <span className="text-muted">({o.count})</span>
              </label>
            ))}
          </fieldset>
        );
      })}
    </FilterForm>
  );
}

function Tile({ category, item }: { category: string; item: LibraryItem }) {
  const meta = [levelLabel(category, item.level), item.durationMin ? `${item.durationMin} min` : null, item.authorName].filter(Boolean).join(' · ');
  const tag = category === 'gym' ? item.muscles[0] : item.supports[0] ? humanise(item.supports[0]) : null;
  return (
    <Link href={`/learn/${category}/${item.slug}`} className="flex flex-col gap-1">
      <span aria-hidden="true" className="flex aspect-[4/5] w-full items-end bg-ink p-4 font-display text-[32px] uppercase leading-[0.95] text-paper">
        {item.title}
      </span>
      {tag ? <span className="mt-2.5 text-[13px] font-semibold">{tag}</span> : null}
      <span className={`${tag ? '' : 'mt-2.5 '}text-[13px] font-semibold ${item.isSample ? 'text-warning' : 'text-muted'}`}>{item.isSample ? 'Sample, awaiting a coach' : 'Coach-verified'}</span>
      <span className="text-[16px] font-medium">{item.title}</span>
      <span className="text-[15px] text-muted">{meta}</span>
    </Link>
  );
}

async function Library({ params, searchParams }: PageProps<'/learn/[category]'>) {
  const { category } = await params;
  const found = await liveCategory(category);
  if (!found) notFound();
  const filters = parseFilters(await searchParams);
  const supabase = db();
  const [items, { data: disciplines }] = await Promise.all([libraryItems(category), supabase.from('disciplines').select('slug, name').eq('category_id', category)]);
  const names = new Map((disciplines ?? []).map((d) => [d.slug, d.name]));
  const shown = items.filter((item) => matches(item, filters));
  const coaches = new Set(shown.map((i) => i.authorName).filter(Boolean)).size;
  const chosen = facetKeys.flatMap((key) => (filters[key] ?? []).map((value) => ({ key, value })));
  const noun = itemNoun(category, shown.length);

  return (
    <main className="mx-auto w-full max-w-[1440px] px-4 pb-20 pt-8 md:px-10">
      <nav aria-label="Sports" className="flex flex-wrap gap-2">
        {found.all.map((c) =>
          c.is_live ? (
            <Link
              key={c.id}
              href={`/learn/${c.id}`}
              aria-current={c.id === category ? 'page' : undefined}
              className={`inline-flex min-h-11 items-center rounded-pill px-5 text-[16px] font-medium ${c.id === category ? 'bg-ink text-paper' : 'border border-line-strong'}`}
            >
              {c.name}
            </Link>
          ) : (
            <span key={c.id} className="inline-flex min-h-11 items-center rounded-pill border border-dashed border-line-strong px-5 text-[16px] font-medium text-faint">
              {c.name}, coming later
            </span>
          ),
        )}
      </nav>

      <div className="mt-6 flex flex-wrap items-end justify-between gap-6">
        <h1 className="m-0 font-display text-[clamp(56px,9vw,140px)] font-normal uppercase leading-[0.85]">{found.current.name}</h1>
        <p className="m-0 text-[16px] font-medium text-muted">
          {shown.length} {noun} shown{coaches ? ` · ${coaches} ${coaches === 1 ? 'coach' : 'coaches'}` : ''}
        </p>
      </div>

      <div className="mt-10 flex flex-col gap-10 md:flex-row md:items-start">
        <details className="border-y border-line py-3 md:hidden">
          <summary className="flex min-h-11 cursor-pointer items-center text-[16px] font-medium">Filters{chosen.length ? ` (${chosen.length})` : ''}</summary>
          <div className="pt-4">
            <Facets category={category} items={items} filters={filters} names={names} />
          </div>
        </details>
        <aside aria-label="Filters" className="hidden w-[240px] shrink-0 md:block">
          <Facets category={category} items={items} filters={filters} names={names} />
        </aside>

        <section aria-label={`${found.current.name} ${itemNoun(category, 2)}`} className="min-w-0 flex-1">
          {chosen.length ? (
            <ul className="m-0 mb-4 flex list-none flex-wrap gap-2 p-0">
              {chosen.map(({ key, value }) => (
                <li key={`${key}-${value}`}>
                  <Link href={hrefWithout(category, filters, key, value)} className="inline-flex min-h-11 items-center gap-2 rounded-pill border border-line-strong px-3.5 text-[14px] font-medium">
                    {key === 'discipline' ? (names.get(value) ?? humanise(value)) : key === 'level' ? levelLabel(category, value) : humanise(value)}
                    <span className="sr-only">Remove filter</span>
                    <span aria-hidden="true">×</span>
                  </Link>
                </li>
              ))}
              <li>
                <Link href={`/learn/${category}`} className="inline-flex min-h-11 items-center px-2 text-[14px] font-medium underline underline-offset-4">
                  Clear all
                </Link>
              </li>
            </ul>
          ) : null}
          {shown.length ? (
            <div className="grid grid-cols-2 gap-x-2 gap-y-8 sm:grid-cols-[repeat(auto-fill,minmax(260px,1fr))]">
              {shown.map((item) => (
                <Tile key={item.slug} category={category} item={item} />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-start gap-3 bg-mist p-8">
              <p className="m-0 text-[18px] font-medium">No {itemNoun(category, 2)} match these filters.</p>
              <Link href={`/learn/${category}`} className="text-[16px] font-medium underline underline-offset-4">
                Clear all filters
              </Link>
            </div>
          )}
          {shown.some((i) => i.isSample) ? (
            <p className="mt-10 text-[14px] text-muted">
              <Tag variant="warning" className="mr-2">
                Sample
              </Tag>
              Sample items are placeholders until a coach replaces them. The AI guide never cites them.
            </p>
          ) : null}
        </section>
      </div>
    </main>
  );
}

export default function LibraryPage(props: PageProps<'/learn/[category]'>) {
  return (
    <Suspense fallback={<main className="mx-auto min-h-[60vh] w-full max-w-[1440px]" />}>
      <Library {...props} />
    </Suspense>
  );
}
