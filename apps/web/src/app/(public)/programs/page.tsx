import type { Metadata } from 'next';
import Link from 'next/link';
import { connection } from 'next/server';
import { Suspense } from 'react';
import { db } from '@/lib/db';

export const metadata: Metadata = { title: 'Programs · FitSphere', description: 'Weekly plans built by coaches. You join with your coach’s invite link.' };

// P-Programs (M6-01). Programs are private and joined by invite (M4-05b), so this lists only the programs live
// coaches chose to show on their profile, each linking to its coach. There is no public page per program.
// shortcut: one coach_programs call per live coach; fine for the beta's few coaches, move to one RPC past ~50.
async function ShownPrograms() {
  // Live data: read at request time, never at build time.
  await connection();
  const supabase = db();
  const coaches = await supabase.rpc('find_coaches', {});
  if (coaches.error) throw coaches.error;
  const lists = await Promise.all(coaches.data.slice(0, 24).map((c) => supabase.rpc('coach_programs', { coach: c.coach_id })));
  const programs = lists.flatMap((r, n) => {
    if (r.error) throw r.error;
    const c = coaches.data[n]!;
    return r.data.map((p) => ({ ...p, coachId: c.coach_id, coachName: c.name }));
  });
  if (!programs.length) {
    return (
      <p className="m-0 border border-dashed border-line-strong p-6 text-[16px] text-ink-soft">
        No coach shows a program publicly yet. Your coach sends you an invite link to join theirs.
      </p>
    );
  }
  return (
    <ul className="m-0 grid list-none gap-4 p-0 sm:grid-cols-2 lg:grid-cols-3">
      {programs.map((p) => (
        <li key={p.program_id}>
          <Link href={`/coaches/${p.coachId}`} className="flex h-full flex-col gap-1 border border-line-strong p-5 hover:border-ink">
            <span className="text-[20px] font-semibold">{p.title}</span>
            <span className="text-[14px] text-ink-soft">
              {[`${p.weeks} ${p.weeks === 1 ? 'week' : 'weeks'}`, p.coachName, p.enrolled_band ? `${p.enrolled_band}+ athletes` : null].filter(Boolean).join(' · ')}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

const steps: [string, string][] = [
  ['Your coach sends you a link', 'Usually on WhatsApp. Each program has its own link.'],
  ['You sign up in a minute', 'With an email link. FitSphere is for adults 18 and over.'],
  ['It shows up in Today', 'Sessions from every program, whatever the sport, in one view.'],
];

export default function ProgramsPage() {
  return (
    <main className="mx-auto flex w-full max-w-[1440px] flex-col gap-10 px-4 pb-20 pt-10 md:px-10">
      <div className="flex max-w-[760px] flex-col gap-3">
        <h1 className="m-0 font-display text-[56px] font-normal uppercase leading-[0.95] md:text-[72px]">Programs</h1>
        <p className="m-0 text-[18px] leading-[1.5] text-ink-soft">Weekly plans built by coaches, for boxing, S&amp;C and the gym, in one schedule. You join with your coach’s invite link.</p>
      </div>
      <Suspense fallback={<div className="min-h-[160px]" />}>
        <ShownPrograms />
      </Suspense>
      <section aria-labelledby="how" className="flex flex-col gap-4">
        <h2 id="how" className="m-0 text-[28px] font-semibold">
          How joining works
        </h2>
        <ol className="m-0 grid list-none gap-4 p-0 md:grid-cols-3">
          {steps.map(([title, text], i) => (
            <li key={title} className="flex flex-col gap-2 bg-mist p-5">
              <span className="flex size-9 items-center justify-center rounded-full bg-ink text-[15px] font-semibold text-paper">{i + 1}</span>
              <span className="text-[18px] font-semibold">{title}</span>
              <span className="text-[15px] text-ink-soft">{text}</span>
            </li>
          ))}
        </ol>
      </section>
      <div className="flex flex-wrap items-center justify-between gap-4 border-t border-line pt-8">
        <p className="m-0 text-[18px] font-medium">Coach athletes already? Build your program here.</p>
        <Link href="/for-coaches" className="text-[16px] font-medium underline underline-offset-4">
          Coach with FitSphere
        </Link>
      </div>
    </main>
  );
}
