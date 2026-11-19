import { addDays, formatInr, indiaToday } from '@fitsphere/core';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { isUuid } from '@/lib/programs';
import { supabaseServer } from '@/lib/supabase/server';
import { requireRole } from '@/lib/viewer';
import { HireForm } from './hire-form';

export const metadata: Metadata = { title: 'Hire a coach · FitSphere' };

// X-Hire: choose a package and send a request. Nothing is charged until the coach accepts.
async function Hire({ params }: PageProps<'/hire/[coach]'>) {
  const viewer = await requireRole('athlete');
  const { coach } = await params;
  if (!isUuid(coach)) notFound();
  const supabase = await supabaseServer();
  const [name, packages, room] = await Promise.all([
    supabase.rpc('coach_public_name', { coach }),
    supabase.from('packages').select('id, title, kind, price_paise').eq('coach_id', coach).eq('live', true).order('price_paise'),
    supabase.rpc('coach_has_room', { coach }),
  ]);
  for (const r of [name, packages, room]) if (r.error) throw r.error;
  if (!name.data || viewer.userId === coach) notFound();
  const today = indiaToday();

  return (
    <>
      <Link href={`/coaches/${coach}`} className="text-[15px] font-medium underline underline-offset-4">
        {name.data}&apos;s profile
      </Link>
      <h1 className="m-0 font-display text-[48px] font-normal uppercase leading-[0.95]">Hire {name.data}</h1>
      <ol className="m-0 flex flex-col gap-1 pl-5 text-[15px] text-ink-soft">
        <li>You send a request.</li>
        <li>{name.data} accepts or declines.</li>
        <li>You pay and coaching starts.</li>
      </ol>
      {room.data ? (
        <HireForm
          coachName={name.data}
          today={today}
          latest={addDays(today, 60)}
          packages={packages.data!.map((k) => ({ id: k.id, title: k.title, price: formatInr(k.price_paise), per: k.kind === 'monthly' ? 'a month' : 'a session' }))}
        />
      ) : (
        <p className="m-0 text-[16px]">{name.data} is not taking new clients right now. Shortlist them and check back later.</p>
      )}
    </>
  );
}

export default function HirePage(props: PageProps<'/hire/[coach]'>) {
  return (
    <main className="mx-auto flex w-full max-w-[720px] flex-col gap-6 px-4 pb-24 pt-8 md:px-10">
      <Suspense fallback={null}>
        <Hire {...props} />
      </Suspense>
    </main>
  );
}
