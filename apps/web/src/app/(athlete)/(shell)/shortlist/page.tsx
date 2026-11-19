import { formatInr } from '@fitsphere/core';
import { buttonClass, Tag } from '@fitsphere/ui';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { ShortlistButton } from '@/app/(public)/coaches/shortlist-button';
import { supabaseServer } from '@/lib/supabase/server';
import { requireRole } from '@/lib/viewer';

export const metadata: Metadata = { title: 'Shortlist · FitSphere' };

// X-Shortlist: the coaches a person saved. RLS shows each person only their own; coaches are not told.
// Remove buttons are forms of their own, so they sit below the compare form, not inside it.
async function Shortlist() {
  await requireRole('athlete');
  const supabase = await supabaseServer();
  const { data: rows, error } = await supabase.from('shortlists').select('coach_id').order('created_at');
  if (error) throw error;
  const ids = rows.map((r) => r.coach_id);
  const coaches = ids.length ? await supabase.rpc('find_coaches', { ids }) : { data: [], error: null };
  if (coaches.error) throw coaches.error;
  // In the order they were shortlisted. A coach who stopped being live drops out.
  const shown = ids.map((id) => coaches.data.find((c) => c.coach_id === id)).filter((c) => c !== undefined);

  if (!shown.length) {
    return (
      <p className="m-0 text-[16px]">
        No coaches yet.{' '}
        <Link href="/coaches" className="underline underline-offset-4">
          Find a coach
        </Link>{' '}
        and tap Shortlist to keep them here.
      </p>
    );
  }
  return (
    <form method="get" action="/coaches/compare" className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-4">
        <button type="submit" className={buttonClass()}>
          Compare selected
        </button>
        <span className="text-[15px] text-muted">Choose up to 3.</span>
        <Link href="/coaches" className="text-[15px] font-medium underline underline-offset-4">
          Find more coaches
        </Link>
      </div>
      <ul className="m-0 grid list-none gap-6 p-0 lg:grid-cols-2">
        {shown.map((c) => (
          <li key={c.coach_id} className="flex flex-col gap-2 border border-line p-5">
            {c.checked ? <Tag variant="success">Credentials checked</Tag> : <Tag variant="outline">Credentials self-reported</Tag>}
            <Link href={`/coaches/${c.coach_id}`} className="text-[22px] font-semibold">
              {c.name}
            </Link>
            <p className="m-0 text-[16px]">{c.headline}</p>
            <p className="m-0 text-[15px] text-muted">
              {[c.formats.map((x) => (x === 'in_person' ? 'In person' : 'Online')).join(' · '), c.coach_city, c.years ? `${c.years} years` : ''].filter(Boolean).join(' · ')}
            </p>
            {c.from_paise !== null ? <p className="m-0 text-[16px] font-medium">From {formatInr(c.from_paise)}/month</p> : null}
            <label className="flex min-h-11 items-center gap-2.5 text-[15px]">
              <input type="checkbox" name="ids" value={c.coach_id} className="size-[18px] accent-ink" />
              Compare {c.name}
            </label>
          </li>
        ))}
      </ul>
    </form>
  );
}

async function Remove() {
  await requireRole('athlete');
  const supabase = await supabaseServer();
  const { data: rows, error } = await supabase.from('shortlists').select('coach_id');
  if (error) throw error;
  if (!rows.length) return null;
  const { data: coaches, error: e2 } = await supabase.rpc('find_coaches', { ids: rows.map((r) => r.coach_id) });
  if (e2) throw e2;
  return (
    <section aria-labelledby="remove" className="flex flex-col gap-2">
      <h2 id="remove" className="m-0 text-[18px] font-semibold">
        Remove from shortlist
      </h2>
      <div className="flex flex-wrap gap-2">
        {coaches.map((c) => (
          <ShortlistButton key={c.coach_id} coachId={c.coach_id} on signedIn name={c.name} />
        ))}
      </div>
    </section>
  );
}

export default function ShortlistPage() {
  return (
    <main className="mx-auto flex w-full max-w-[1200px] flex-col gap-8 px-4 pb-24 pt-8 md:px-10">
      <div className="flex flex-col gap-2">
        <h1 className="m-0 font-display text-[48px] font-normal uppercase leading-[0.95]">Shortlist</h1>
        <p className="m-0 text-[15px] text-muted">Only you see your shortlist. Coaches are not told.</p>
      </div>
      <Suspense fallback={null}>
        <Shortlist />
        <Remove />
      </Suspense>
    </main>
  );
}
