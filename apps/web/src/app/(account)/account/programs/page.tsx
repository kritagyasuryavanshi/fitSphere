import { indiaToday, programDay } from '@fitsphere/core';
import { buttonClass } from '@fitsphere/ui';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { supabaseServer } from '@/lib/supabase/server';
import { requireSignedIn } from '@/lib/viewer';

export const metadata: Metadata = { title: 'My programs · FitSphere' };

const day = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' });

async function Programs({ searchParams }: PageProps<'/account/programs'>) {
  await requireSignedIn();
  const { left } = await searchParams;
  const supabase = await supabaseServer();
  const { data, error } = await supabase.rpc('my_programs');
  if (error) throw error;
  const today = indiaToday();

  return (
    <>
      {left === '1' ? (
        <p role="status" className="m-0 bg-success-soft p-4 text-[15px] font-medium text-success">
          You left the program. Its sessions are gone from Today, and the coach no longer sees your logs.
        </p>
      ) : null}
      {!data.length ? (
        <div className="flex flex-col items-start gap-3 bg-mist p-8">
          <p className="m-0 text-[18px] font-medium">No programs yet</p>
          <p className="m-0 text-[16px] text-muted">When a coach sends you an invite link, open it to join their program.</p>
        </div>
      ) : (
        <ul aria-label="My programs" className="m-0 flex list-none flex-col gap-4 p-0">
          {data.map((p) => {
            const at = programDay(p.start_date, p.weeks, today);
            const where = at ? `week ${at.week} of ${p.weeks}` : today < p.start_date ? 'starts soon' : 'finished';
            return (
              <li key={p.enrollment_id} className="flex flex-col gap-3 border border-line p-5">
                <h2 className="m-0 font-display text-[28px] font-normal uppercase leading-none">{p.title}</h2>
                <p className="m-0 text-[15px] text-muted">
                  {p.coach_name || 'Coach'} · {where} · joined {day.format(new Date(p.joined_at))}
                </p>
                <div className="flex flex-wrap gap-5">
                  <Link href="/today" className="inline-flex min-h-11 items-center text-[15px] font-medium underline underline-offset-4">
                    Open in Today
                  </Link>
                  <Link
                    href={`/account/programs/${p.enrollment_id}/leave`}
                    className="inline-flex min-h-11 items-center text-[15px] font-medium text-danger underline underline-offset-4"
                  >
                    Leave program<span className="sr-only">: {p.title}</span>
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

export default function MyProgramsPage(props: PageProps<'/account/programs'>) {
  return (
    <main className="mx-auto flex w-full max-w-[760px] flex-col gap-6 px-4 pb-20 pt-8 md:px-10">
      <Link href="/account" className="self-start text-[14px] font-medium underline underline-offset-4">
        Account
      </Link>
      <h1 className="m-0 font-display text-[48px] font-normal uppercase leading-[0.95]">My programs</h1>
      <Suspense fallback={null}>
        <Programs {...props} />
      </Suspense>
      <Link href="/account" className={`${buttonClass({ variant: 'light' })} self-start`}>
        Back to account
      </Link>
    </main>
  );
}
