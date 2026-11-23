import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = { title: 'Help · FitSphere', description: 'Answers about joining a program, logging training, lessons and your data.' };

// P-Help (M6-01). Each answer says what the app does today; the beta has hiring, chat and Ask AI closed.
const topics: [string, string, [string, string][]][] = [
  [
    'start',
    'Getting started',
    [
      ['How do I join my coach’s program?', 'Open the invite link your coach sent. Sign in or create an account, and the program appears in Today.'],
      ['Can I use FitSphere without a coach?', 'Yes. Every lesson in the library is free to watch, and you can add drills to Today from any lesson.'],
      ['Why do you need my date of birth?', 'FitSphere is for adults 18 and over. We check age once at sign-up.'],
      ['Can I hire a coach here?', 'Not yet. During the beta you can browse coaches and shortlist them. Hiring and messages open later.'],
    ],
  ],
  [
    'train',
    'Training and logging',
    [
      ['Who sees my session logs?', 'You, and the coach of the program the session belongs to. Logs are marked self-reported.'],
      ['How is adherence worked out?', 'Sessions completed divided by sessions scheduled up to today, rounded down to a whole percent.'],
    ],
  ],
  [
    'review',
    'How lessons are reviewed',
    [
      ['What does Coach-verified mean?', 'A coach wrote the lesson and a second coach checked technique and safety. Sample lessons say Sample until a coach replaces them.'],
      ['Can I become a coach?', 'Yes. Apply from the For coaches page. We check each application before coach tools turn on.'],
    ],
  ],
  [
    'data',
    'Your data',
    [
      ['How do I download my data?', 'Go to Account, then Download my data. You get everything you entered, in one file.'],
      ['How do I delete my account?', 'Go to Account, then Delete account. We remove your profile, answers and logs.'],
    ],
  ],
];

export default function HelpPage() {
  return (
    <main className="mx-auto flex w-full max-w-[1440px] flex-col gap-8 px-4 pb-20 pt-10 md:px-10">
      <h1 className="m-0 font-display text-[56px] font-normal uppercase leading-[0.95] md:text-[72px]">Help</h1>
      <div className="grid gap-10 md:grid-cols-[240px_1fr]">
        <nav aria-label="Help topics" className="flex flex-col gap-2 md:sticky md:top-6 md:self-start">
          {topics.map(([id, title]) => (
            <a key={id} href={`#${id}`} className="text-[16px] font-medium underline-offset-4 hover:underline">
              {title}
            </a>
          ))}
        </nav>
        <div className="flex max-w-[760px] flex-col gap-10">
          {topics.map(([id, title, qs]) => (
            <section key={id} id={id} aria-labelledby={`${id}-h`} className="flex flex-col gap-2">
              <h2 id={`${id}-h`} className="m-0 text-[24px] font-semibold">
                {title}
              </h2>
              {qs.map(([q, a]) => (
                <details key={q} className="border-t border-line py-3">
                  <summary className="cursor-pointer text-[17px] font-medium">{q}</summary>
                  <p className="m-0 pt-2 text-[16px] leading-[1.6] text-ink-soft">{a}</p>
                </details>
              ))}
            </section>
          ))}
          <p className="m-0 border-t border-line pt-6 text-[16px] text-ink-soft">
            Still stuck? See the <Link href="/legal/privacy" className="underline">privacy policy</Link> for how to reach us.
          </p>
        </div>
      </div>
    </main>
  );
}
