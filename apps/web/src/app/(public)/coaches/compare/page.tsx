import { formatInr } from '@fitsphere/core';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense, type ReactNode } from 'react';
import { isUuid } from '@/lib/programs';
import { supabaseServer } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Compare coaches · FitSphere' };

// X-Compare: up to 3 live coaches side by side, in the rows of the mockup. Ratings arrive with M4-14, reply times with
// messages (M4-08) and intro calls with 1:1 booking (M4-17); until then those rows say so.
async function Compare({ searchParams }: PageProps<'/coaches/compare'>) {
  const raw = (await searchParams).ids;
  const chosen = [...new Set((Array.isArray(raw) ? raw : raw ? [raw] : []).filter(isUuid))];
  const ids = chosen.slice(0, 3);
  if (!ids.length) {
    return (
      <p className="m-0 text-[16px]">
        Choose coaches to compare from your{' '}
        <Link href="/shortlist" className="underline underline-offset-4">
          shortlist
        </Link>
        .
      </p>
    );
  }
  const supabase = await supabaseServer();
  const [coaches, singles, ...stats] = await Promise.all([
    supabase.rpc('find_coaches', { ids }),
    supabase.from('packages').select('coach_id, price_paise').in('coach_id', ids).eq('live', true).eq('kind', 'single'),
    ...ids.map((id) => supabase.rpc('coach_stats', { coach: id }).maybeSingle()),
  ]);
  if (coaches.error) throw coaches.error;
  if (singles.error) throw singles.error;
  for (const s of stats) if (s.error) throw s.error;
  // In the order chosen; a coach who is not live is left out.
  const cols = ids.flatMap((id, i) => {
    const c = coaches.data.find((x) => x.coach_id === id);
    return c ? [{ c, stats: stats[i].data, single: Math.min(...singles.data.filter((p) => p.coach_id === id).map((p) => p.price_paise)) }] : [];
  });
  if (!cols.length) {
    return (
      <p className="m-0 text-[16px]">
        These coaches are not listed right now. Choose others from your{' '}
        <Link href="/shortlist" className="underline underline-offset-4">
          shortlist
        </Link>
        .
      </p>
    );
  }
  const later = 'Not tracked yet';
  const rows: [string, (col: (typeof cols)[number]) => ReactNode][] = [
    ['Best for', ({ c }) => c.specialties.slice(0, 3).join(', ') || c.headline],
    ['Rating', ({ c }) => (c.review_count ? `${c.rating} · ${c.review_count} reviews` : 'No reviews yet')],
    ['Experience', ({ c }) => (c.years ? `${c.years} years (self-reported)` : 'Not given')],
    ['Credentials', ({ c }) => (c.checked ? 'Credentials checked' : 'Credentials self-reported')],
    ['Online coaching', ({ c }) => (c.from_paise !== null ? `${formatInr(c.from_paise)} / month` : 'Not offered')],
    ['1:1 session', ({ single }) => (Number.isFinite(single) ? formatInr(single) : 'Not offered')],
    ['Format', ({ c }) => c.formats.map((x) => (x === 'in_person' ? `in person${c.coach_city ? ` (${c.coach_city})` : ''}` : 'online')).join(', ').replace(/^./, (m) => m.toUpperCase()) || 'Not given'],
    ['Clients who stayed 3+ months', ({ stats: s }) => (s?.stayed_pct != null ? `${s.stayed_pct}%` : 'Not enough clients yet')],
    ['Replies within', () => later],
    ['Free intro call', () => later],
    ['Languages', ({ c }) => c.languages.join(', ') || 'Not given'],
    [
      'Actions',
      ({ c }) => (
        <Link href={`/coaches/${c.coach_id}`} className="font-medium underline underline-offset-4">
          View {c.name}&apos;s profile
        </Link>
      ),
    ],
  ];

  return (
    <div className="overflow-x-auto">
      {chosen.length > 3 ? <p className="m-0 mb-4 text-[15px]">You chose {chosen.length} coaches. These are the first 3.</p> : null}
      <table className="w-full min-w-[640px] border-collapse text-left text-[15px]">
        <caption className="sr-only">Coaches compared</caption>
        <thead>
          <tr className="border-b border-line-strong">
            <th scope="col" className="w-[200px] py-3 pr-4 font-medium text-muted">
              Detail
            </th>
            {cols.map(({ c }) => (
              <th key={c.coach_id} scope="col" className="py-3 pr-4 text-[18px] font-semibold">
                {c.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(([label, cell]) => (
            <tr key={label} className="border-b border-line">
              <th scope="row" className="py-3 pr-4 font-medium text-muted">
                {label}
              </th>
              {cols.map((col) => (
                <td key={col.c.coach_id} className="py-3 pr-4">
                  {cell(col)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-4 text-[13px] text-muted">Retention comes from FitSphere records. Reply times and intro calls start with messages and 1:1 booking.</p>
    </div>
  );
}

export default function ComparePage(props: PageProps<'/coaches/compare'>) {
  return (
    <main className="mx-auto flex w-full max-w-[1200px] flex-col gap-6 px-4 pb-24 pt-8 md:px-10">
      <Link href="/coaches" className="text-[15px] font-medium underline underline-offset-4">
        Back to coaches
      </Link>
      <h1 className="m-0 font-display text-[48px] font-normal uppercase leading-[0.95]">Compare</h1>
      <Suspense fallback={null}>
        <Compare {...props} />
      </Suspense>
    </main>
  );
}
