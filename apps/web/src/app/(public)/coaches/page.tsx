import { formatInr } from '@fitsphere/core';
import { Tag } from '@fitsphere/ui';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { FilterForm } from '@/app/(public)/learn/[category]/filter-form';
import { rupeesToPaise } from '@/lib/money';
import { supabaseServer } from '@/lib/supabase/server';
import { getViewer } from '@/lib/viewer';
import { ShortlistButton } from './shortlist-button';

export const metadata: Metadata = {
  title: 'Find a coach · FitSphere',
  description: 'Compare coaches by sport, goal, price and credentials. Hire online or in person.',
};

// The fixed sort keys. None of them uses payment or paid placement.
const SORTS = [
  ['best', 'Best match'],
  ['rating', 'Highest rated'],
  ['price', 'Price, low to high'],
  ['checked', 'Credentials checked'],
] as const;
const EXPERIENCE = [
  ['<5', 'Under 5 years'],
  ['5-10', '5 to 10 years'],
  ['10+', '10+ years'],
] as const;

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)?.trim() || undefined;

type Options = readonly (readonly [string, string])[];

function Select({ name, label, value, options, empty = 'Any' }: { name: string; label: string; value?: string; options: Options; empty?: string }) {
  // A value from the URL shows as chosen whatever its letter case; one no live coach has any more still shows, so it can be cleared.
  const match = value ? options.find(([v]) => v.toLowerCase() === value.toLowerCase()) : undefined;
  const list = value && !match ? [...options, [value, value] as const] : options;
  return (
    <label className="flex flex-col gap-1.5 text-[15px] font-medium">
      {label}
      <select name={name} defaultValue={match?.[0] ?? value ?? ''} className="min-h-11 border border-line-strong bg-paper px-3 text-[15px] font-normal">
        <option value="">{empty}</option>
        {list.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </label>
  );
}

async function Directory({ searchParams }: PageProps<'/coaches'>) {
  const sp = await searchParams;
  const f = {
    specialty: one(sp.specialty),
    format: one(sp.format) === 'online' || one(sp.format) === 'in_person' ? one(sp.format) : undefined,
    city: one(sp.city),
    min: one(sp.min),
    max: one(sp.max),
    rating: one(sp.rating) === '4.5' || one(sp.rating) === '4' ? one(sp.rating) : undefined,
    experience: EXPERIENCE.some(([v]) => v === one(sp.experience)) ? one(sp.experience) : undefined,
    checked: one(sp.checked) === 'on',
    language: one(sp.language),
    sort: SORTS.some(([v]) => v === one(sp.sort)) ? one(sp.sort)! : 'best',
  };
  const minPaise = f.min ? rupeesToPaise(f.min) : null;
  const maxPaise = f.max ? rupeesToPaise(f.max) : null;

  const supabase = await supabaseServer();
  const viewer = await getViewer();
  const [choices, shown, mine] = await Promise.all([
    supabase.rpc('coach_filter_options'),
    supabase.rpc('find_coaches', {
      specialty: f.specialty,
      format: f.format,
      city: f.city,
      min_paise: minPaise ?? undefined,
      max_paise: maxPaise ?? undefined,
      min_rating: f.rating ? Number(f.rating) : undefined,
      experience: f.experience,
      checked_only: f.checked,
      language: f.language,
      sort: f.sort,
    }),
    viewer ? supabase.from('shortlists').select('coach_id') : Promise.resolve({ data: [], error: null }),
  ]);
  if (choices.error) throw choices.error;
  if (shown.error) throw shown.error;
  if (mine.error) throw mine.error;
  const listed = new Set((mine.data ?? []).map((r) => r.coach_id));
  // Filter choices come from every live coach, so each one can match someone.
  const of = (kind: string): Options => choices.data.filter((o) => o.kind === kind).map((o) => [o.value, o.value] as const);

  return (
    <div className="mt-8 grid gap-10 md:grid-cols-[280px_1fr]">
      <aside aria-label="Filters">
        <FilterForm>
          <div className="flex flex-col gap-4">
            <Select name="specialty" label="Specialty" value={f.specialty} options={of('specialty')} />
            <Select name="format" label="Format" value={f.format} options={[['online', 'Online'], ['in_person', 'In person']]} />
            <Select name="city" label="City" value={f.city} options={of('city')} />
            <fieldset className="m-0 flex flex-col gap-1.5 border-0 p-0">
              <legend className="pb-1.5 text-[15px] font-medium">Monthly price</legend>
              <div className="flex gap-2">
                <label className="flex flex-1 flex-col gap-1 text-[13px] text-muted">
                  Min ₹
                  <input name="min" inputMode="decimal" defaultValue={f.min ?? ''} className="min-h-11 w-full border border-line-strong px-3 text-[15px] text-ink" />
                </label>
                <label className="flex flex-1 flex-col gap-1 text-[13px] text-muted">
                  Max ₹
                  <input name="max" inputMode="decimal" defaultValue={f.max ?? ''} className="min-h-11 w-full border border-line-strong px-3 text-[15px] text-ink" />
                </label>
              </div>
              {(f.min && minPaise === null) || (f.max && maxPaise === null) ? <p className="m-0 text-[13px] text-danger">Enter prices as rupees, like 4500.</p> : null}
            </fieldset>
            <Select name="rating" label="Rating" value={f.rating} options={[['4.5', '4.5 and up'], ['4', '4.0 and up']]} />
            <Select name="experience" label="Experience" value={f.experience} options={EXPERIENCE} />
            <label className="flex min-h-11 items-center gap-2.5 text-[15px]">
              <input type="checkbox" name="checked" defaultChecked={f.checked} className="size-[18px] accent-ink" />
              Credentials checked
            </label>
            <Select name="language" label="Language" value={f.language} options={of('language')} />
            <Select name="sort" label="Sort by" value={f.sort === 'best' ? undefined : f.sort} options={SORTS.slice(1)} empty="Best match" />
          </div>
        </FilterForm>
      </aside>

      <section aria-label="Coaches">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <p className="m-0 text-[16px] font-medium text-muted">
            {shown.data.length} {shown.data.length === 1 ? 'coach' : 'coaches'}
          </p>
          {viewer ? (
            <Link href="/shortlist" className="text-[15px] font-medium underline underline-offset-4">
              Your shortlist ({listed.size})
            </Link>
          ) : null}
        </div>
        {shown.data.length ? (
          <ul className="m-0 mt-4 grid list-none gap-6 p-0 lg:grid-cols-2">
            {shown.data.map((c) => (
              <li key={c.coach_id} className="flex flex-col gap-2 border border-line p-5">
                {c.checked ? (
                  <Tag variant="success">Credentials checked</Tag>
                ) : (
                  <Tag variant="outline">Credentials self-reported</Tag>
                )}
                <Link href={`/coaches/${c.coach_id}`} className="text-[22px] font-semibold">
                  {c.name}
                </Link>
                <p className="m-0 text-[16px]">{c.headline}</p>
                <div className="flex flex-wrap gap-2">
                  {c.specialties.map((s) => (
                    <Tag key={s} variant="outline">
                      {s}
                    </Tag>
                  ))}
                </div>
                <p className="m-0 text-[15px] text-muted">
                  {c.review_count ? `${c.rating} (${c.review_count} verified reviews)` : 'No reviews yet'}
                </p>
                <p className="m-0 text-[15px] text-muted">
                  {[c.formats.map((x) => (x === 'in_person' ? 'In person' : 'Online')).join(' · '), c.coach_city, c.years ? `${c.years} years` : ''].filter(Boolean).join(' · ')}
                </p>
                {c.from_paise !== null ? <p className="m-0 text-[16px] font-medium">From {formatInr(c.from_paise)}/month</p> : null}
                {viewer?.userId === c.coach_id ? null : <ShortlistButton coachId={c.coach_id} on={listed.has(c.coach_id)} signedIn={!!viewer} name={c.name} />}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-[16px]">
            No coach matches these filters. <Link href="/coaches" className="underline underline-offset-4">Clear filters</Link>
          </p>
        )}
        <p className="mt-8 text-[13px] text-muted">Order never depends on payment. Ratings come only from clients who paid for coaching on FitSphere.</p>
      </section>
    </div>
  );
}

export default function CoachesPage(props: PageProps<'/coaches'>) {
  return (
    <main className="mx-auto w-full max-w-[1440px] px-4 pb-20 pt-8 md:px-10">
      <h1 className="m-0 font-display text-[clamp(56px,9vw,120px)] font-normal uppercase leading-[0.85]">Find a coach</h1>
      <p className="m-0 mt-4 max-w-[640px] text-[18px] text-ink-soft">Compare coaches by sport, goal, price and credentials. Hire online or in person.</p>
      <Suspense fallback={null}>
        <Directory {...props} />
      </Suspense>
    </main>
  );
}
