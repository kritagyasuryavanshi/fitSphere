import { buttonClass } from '@fitsphere/ui';
import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { Suspense } from 'react';
import { supabaseServer } from '@/lib/supabase/server';
import { getViewer } from '@/lib/viewer';
import { ApplyForm } from './apply-form';

export const metadata: Metadata = { title: 'Coach with FitSphere' };

const tools = [
  ['Build', 'Weeks, sessions and exercises. Mix boxing and gym work from the reviewed library.'],
  ['Share', 'One invite link per program. You see who joined and can turn the link off.'],
  ['See', 'Who trained, what they logged, and who needs a word from you.'],
];

const steps = ['You write the lesson and link your YouTube video.', 'A second coach checks technique and safety.', 'It goes live with your name on it. Nobody approves their own lesson.'];

// The apply box depends on who is looking: a guest, an applicant, a coach, or someone who can apply.
async function Apply() {
  const viewer = await getViewer();
  if (!viewer) {
    return (
      <div className="flex flex-col gap-3">
        <p className="m-0 text-[16px] text-ink-soft">Log in or join first, so an approval can turn on coach tools for your account.</p>
        <Link href="/sign-in" className={`${buttonClass()} self-start`}>
          Log in or join to apply
        </Link>
      </div>
    );
  }
  if (viewer.roles.includes('coach')) {
    return (
      <Link href="/coach" className={`${buttonClass()} self-start`}>
        Open your coach tools
      </Link>
    );
  }
  const supabase = await supabaseServer();
  const [{ data: pending }, { data: sports }] = await Promise.all([
    supabase.from('coach_applications').select('id').eq('user_id', viewer.userId).eq('status', 'pending').maybeSingle(),
    supabase.from('categories').select('id, name').eq('is_live', true).order('sort'),
  ]);
  if (pending) return <p className="m-0 text-[16px] font-medium">Your application is with us. We reply by email.</p>;
  return <ApplyForm name={viewer.name} sports={sports ?? []} />;
}

export default function ForCoachesPage() {
  return (
    <>
      <section className="relative flex min-h-[420px] items-end overflow-hidden bg-ink md:min-h-[560px]">
        <Image src="/images/coach-ring.jpg" alt="Coach leaning on the ring ropes" fill priority sizes="100vw" className="object-cover" />
        <div aria-hidden="true" className="absolute inset-0 bg-black/45" />
        <div className="relative mx-auto flex w-full max-w-[1440px] flex-col gap-4 px-4 pb-12 text-paper md:px-10">
          <h1 className="m-0 max-w-[14ch] font-display text-[48px] font-normal uppercase leading-[0.95] md:text-[80px]">Your program. One link. Every round logged.</h1>
          <p className="m-0 text-[18px]">Build the plan, send one link on WhatsApp, and see who trained.</p>
          <a href="#apply" className={`${buttonClass({ variant: 'volt' })} self-start`}>
            Apply to coach
          </a>
        </div>
      </section>
      <main className="mx-auto flex max-w-[1440px] flex-col gap-14 px-4 py-14 md:px-10">
        <div className="grid gap-8 md:grid-cols-3">
          {tools.map(([title, text]) => (
            <div key={title} className="flex flex-col gap-2">
              <h2 className="m-0 text-[22px] font-medium">{title}</h2>
              <p className="m-0 text-[16px] text-ink-soft">{text}</p>
            </div>
          ))}
        </div>
        <section aria-labelledby="rules" className="flex flex-col gap-4">
          <h2 id="rules" className="m-0 text-[22px] font-medium">
            How lessons go live
          </h2>
          <ol className="m-0 flex list-none flex-col gap-3 p-0">
            {steps.map((step, i) => (
              <li key={step} className="flex items-start gap-3 text-[16px]">
                <span className="flex size-7 flex-none items-center justify-center rounded-full bg-ink text-[14px] font-semibold text-paper">{i + 1}</span>
                {step}
              </li>
            ))}
          </ol>
        </section>
        <section id="apply" aria-labelledby="applyh" className="grid gap-8 md:grid-cols-[1fr_2fr]">
          <div className="flex flex-col gap-3">
            <h2 id="applyh" className="m-0 font-display text-[40px] font-normal uppercase leading-[0.95]">
              Apply
            </h2>
            <p className="m-0 text-[16px] text-ink-soft">We are starting with a few founding coaches in boxing and S&amp;C. Tell us how you coach today.</p>
          </div>
          <Suspense fallback={null}>
            <Apply />
          </Suspense>
        </section>
      </main>
    </>
  );
}
