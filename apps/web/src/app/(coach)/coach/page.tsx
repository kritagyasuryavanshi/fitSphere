import type { Metadata } from 'next';
import { Suspense } from 'react';
import { requireRole } from '@/lib/viewer';

export const metadata: Metadata = { title: 'Set up your camp · FitSphere Coach' };

// K-CoachEmpty: the first-run screen a new coach lands on. The dashboard with athletes (C-CoachDash) replaces it in M3.
// shortcut: the pages behind each step (profile, packages, programs, invites, lessons) come in M3 and M4; until then
// each step says "Available soon" instead of linking to a page that does not exist yet.
const steps = [
  ['Fill in your profile', 'Photo, headline, how you coach'],
  ['Set your packages and prices', 'Athletes can hire you once one package is live'],
  ['Build your first program', 'Weeks, sessions, drills from the library'],
  ['Invite your first athlete', 'Share one link on WhatsApp'],
];

const empties = [
  ['No athletes yet', 'Athletes you invite, and clients who hire you, show up here with their training each week.'],
  ['No requests yet', 'Requests appear once your profile has a live package. You choose who to accept.'],
  ['No lessons yet', 'Your lessons and their review status appear here.'],
];

const soon = <span className="text-[13px] font-medium text-muted">Available soon</span>;

async function FirstRun() {
  const viewer = await requireRole('coach');
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
            {/* shortcut: progress counts once profiles, packages and programs exist (M3, M4); today none is done. */}
            <span className="text-[14px] text-muted">0 of 4 done</span>
          </div>
          <ol className="m-0 flex list-none flex-col p-0">
            {steps.map(([title, hint], i) => (
              <li key={title} className="flex items-center gap-4 border-t border-line py-3">
                <span className="flex size-8 flex-none items-center justify-center rounded-full border border-line-strong text-[14px] font-semibold">{i + 1}</span>
                <span className="flex flex-1 flex-col">
                  <span className="text-[16px] font-medium">{title}</span>
                  <span className="text-[14px] text-muted">{hint}</span>
                </span>
                {soon}
              </li>
            ))}
          </ol>
        </section>
        <aside className="flex flex-col gap-3 bg-mist p-5">
          <h2 className="m-0 text-[20px] font-medium">Got lessons on YouTube?</h2>
          <p className="m-0 text-[15px] text-ink-soft">Add them to the library. A second coach reviews each one, then it goes live with your name.</p>
          {soon}
        </aside>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {empties.map(([title, text]) => (
          <section key={title} className="flex flex-col gap-2 border border-dashed border-line-strong p-5">
            <h3 className="m-0 text-[17px] font-medium">{title}</h3>
            <p className="m-0 text-[14px] text-ink-soft">{text}</p>
            {soon}
          </section>
        ))}
      </div>
    </main>
  );
}

export default function CoachHomePage() {
  return (
    <Suspense fallback={null}>
      <FirstRun />
    </Suspense>
  );
}
