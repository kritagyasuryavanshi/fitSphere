import { buttonClass } from '@fitsphere/ui';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { supabaseServer } from '@/lib/supabase/server';
import { requireRole } from '@/lib/viewer';
import { Dashboard } from './dashboard';

export const metadata: Metadata = { title: 'Athletes · FitSphere Coach' };

// K-CoachEmpty: the first-run screen for a coach without a program. With one, the dashboard (C-CoachDash) shows.
// Without a program the last two steps are never done, so only the profile and a live package count.
const empties: [string, string, string, string][] = [
  ['No athletes yet', 'Athletes you invite, and clients who hire you, show up here with their training each week.', 'Build a program to invite', '/coach/programs/new'],
  ['No requests yet', 'Requests appear once your profile has a live package. You choose who to accept.', 'Add a package', '/coach/profile'],
  ['No lessons yet', 'Your lessons and their review status appear here.', 'Write a lesson', '/coach/lessons/new'],
];

const linkClass = 'text-[14px] font-medium underline underline-offset-4';

async function CoachHome() {
  const viewer = await requireRole('coach');
  const supabase = await supabaseServer();
  const [programs, profile, packages] = await Promise.all([
    supabase.from('programs').select('id').eq('coach_id', viewer.userId),
    supabase.from('coach_profiles').select('headline').eq('coach_id', viewer.userId).maybeSingle(),
    supabase.from('packages').select('id').eq('coach_id', viewer.userId).eq('live', true).limit(1),
  ]);
  for (const r of [programs, profile, packages]) if (r.error) throw r.error;
  if (programs.data!.length) return <Dashboard supabase={supabase} name={viewer.name} programIds={programs.data!.map((p) => p.id)} />;
  const steps: [string, string, string, boolean][] = [
    ['Fill in your profile', 'Photo, headline, how you coach', '/coach/profile', !!profile.data?.headline?.trim()],
    ['Set your packages and prices', 'Athletes can hire you once one package is live', '/coach/profile', packages.data!.length > 0],
    ['Build your first program', 'Weeks, sessions, drills from the library', '/coach/programs/new', false],
    ['Invite your first athlete', 'Share one link on WhatsApp', '/coach/programs', false],
  ];
  const done = steps.filter((s) => s[3]).length;
  return (
    <main className="mx-auto flex max-w-[1440px] flex-col gap-8 px-4 py-10 md:px-10">
      <div className="flex flex-col gap-2">
        <p className="m-0 text-[15px] font-medium text-muted">Welcome, {viewer.name}. Your coach tools are on.</p>
        <h1 className="m-0 font-display text-[48px] font-normal uppercase leading-[0.95] md:text-[64px]">Set up your camp</h1>
      </div>
      <div className="grid gap-6 md:grid-cols-[2fr_1fr]">
        <section aria-labelledby="steps" className="flex flex-col gap-4 border border-line-strong p-5">
          <div className="flex items-baseline justify-between gap-4">
            <h2 id="steps" className="m-0 text-[20px] font-medium">
              Four steps to your first athlete
            </h2>
            <span className="text-[14px] text-muted">{done} of 4 done</span>
          </div>
          <div role="progressbar" aria-label="Setup progress" aria-valuenow={done} aria-valuemin={0} aria-valuemax={4} className="h-1.5 bg-mist">
            <div className="h-full bg-volt" style={{ width: `${(done / 4) * 100}%` }} />
          </div>
          <ol className="m-0 flex list-none flex-col p-0">
            {steps.map(([title, hint, href, isDone], i) => (
              <li key={title} className="flex items-center gap-4 border-t border-line py-3">
                <span className={`flex size-8 flex-none items-center justify-center rounded-full text-[14px] font-semibold ${isDone ? 'bg-ink text-paper' : 'border border-line-strong'}`}>{isDone ? '✓' : i + 1}</span>
                <span className="flex flex-1 flex-col">
                  <span className="text-[16px] font-medium">{title}</span>
                  <span className="text-[14px] text-muted">{hint}</span>
                </span>
                {isDone ? (
                  <span className="text-[14px] font-medium text-success">Done</span>
                ) : (
                  <Link href={href} className={linkClass}>
                    Start<span className="sr-only">: {title}</span>
                  </Link>
                )}
              </li>
            ))}
          </ol>
        </section>
        <aside className="flex flex-col items-start gap-3 bg-mist p-5">
          <h2 className="m-0 text-[20px] font-medium">Got lessons on YouTube?</h2>
          <p className="m-0 text-[15px] text-ink-soft">Add them to the library. A second coach reviews each one, then it goes live with your name.</p>
          <Link href="/coach/lessons/new" className={buttonClass({ size: 'small' })}>
            Write a lesson
          </Link>
        </aside>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {empties.map(([title, text, cta, href]) => (
          <section key={title} className="flex flex-col items-start gap-2 border border-dashed border-line-strong p-5">
            <h3 className="m-0 text-[17px] font-medium">{title}</h3>
            <p className="m-0 text-[14px] text-ink-soft">{text}</p>
            <Link href={href} className={linkClass}>
              {cta}
            </Link>
          </section>
        ))}
      </div>
    </main>
  );
}

export default function CoachHomePage() {
  return (
    <Suspense fallback={null}>
      <CoachHome />
    </Suspense>
  );
}
