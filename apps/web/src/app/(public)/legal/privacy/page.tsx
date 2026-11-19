import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = { title: 'Privacy policy · FitSphere' };

// What the app actually stores and who sees it, kept in step with the schema. Pending legal review (owner item O-07).
// An id cannot hold spaces: aria-labelledby would read each word as a separate id.
const slug = (title: string) => title.toLowerCase().replace(/[^a-z0-9]+/g, '-');

const sections: [string, string[]][] = [
  [
    'What we collect',
    [
      'Your email address, to sign you in.',
      'Your name, date of birth and the sports you train, from sign-up.',
      'Your answers about training: days per week, equipment and any limits or injuries you choose to share.',
      'Body weight and height, only if you enter them.',
      'Your training logs: rounds, sets, reps, loads, effort, technique feel and notes.',
      'Feedback your coach sends you and your replies.',
      'Your consent choices, with the date you made each one.',
    ],
  ],
  [
    'Who sees it',
    [
      'You see everything you entered.',
      'A coach sees your training logs and feedback from their own programs only, never another coach’s. When you leave a program, its coach stops seeing that program’s logs and feedback at once.',
      'A coach also sees your profile, sign-up answers, body weight and height while you are in at least one of their programs. That stops once you have left all of that coach’s programs.',
      'FitSphere admins can see accounts to run the service, for example to approve coaches.',
      'We do not sell your data and we do not show you advertising.',
    ],
  ],
  [
    'The AI guide',
    ['The AI guide uses your injury notes or body measurements only if you turn that on in your account. You can turn it off at any time.'],
  ],
  [
    'Where it is kept',
    [
      'Your data is stored with Supabase in Mumbai, India. The website runs on Vercel.',
      'We email you when your coach sends feedback or publishes a new lesson, and, if you turn it on, on days you have a session. Each email can be turned off on your Notifications page. Emails go through an email provider only to deliver them.',
    ],
  ],
  [
    'Your choices',
    [
      'Download all your data from your account at any time.',
      'Delete your account from your account page. This removes your profile, answers and logs.',
      'Turn each email off on your Notifications page.',
    ],
  ],
];

export default function PrivacyPage() {
  return (
    <main className="mx-auto flex w-full max-w-[760px] flex-col gap-6 px-4 pb-20 pt-8 md:px-10">
      <h1 className="m-0 font-display text-[48px] font-normal uppercase leading-[0.95]">Privacy policy</h1>
      <p className="m-0 text-[15px] text-muted">Last updated 19 November 2026.</p>
      {sections.map(([title, items]) => (
        <section key={title} aria-labelledby={slug(title)} className="flex flex-col gap-2">
          <h2 id={slug(title)} className="m-0 text-[20px] font-semibold">
            {title}
          </h2>
          <ul className="m-0 flex flex-col gap-1.5 pl-5 text-[16px] text-ink-soft">
            {items.map((i) => (
              <li key={i}>{i}</li>
            ))}
          </ul>
        </section>
      ))}
      <p className="m-0 text-[15px] text-muted">
        See also the <Link href="/legal/terms" className="underline">terms of use</Link>.
      </p>
    </main>
  );
}
