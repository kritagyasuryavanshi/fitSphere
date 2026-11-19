import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = { title: 'Terms of use · FitSphere' };

// Plain terms for the current service (no payments yet; M4 adds marketplace terms). Pending legal review (owner item O-07).
const sections: [string, string[]][] = [
  [
    'The service',
    [
      'FitSphere gives athletes lessons, training programs from their coach, and a log of their training. Coaches build programs, invite athletes and give feedback.',
      'Lessons marked "Sample" are examples, not coaching advice from a named coach.',
    ],
  ],
  [
    'Train safely',
    [
      'Training carries a risk of injury. Warm up, train within your limits and stop if you feel pain.',
      'FitSphere and its coaches do not give medical advice. For pain or injury, see a doctor or physiotherapist first.',
    ],
  ],
  [
    'Your account',
    [
      'Keep your sign-in email secure. You are responsible for what is done with your account.',
      'What you log is self-reported. Coaches see it while you are in their program.',
    ],
  ],
  [
    'Coaches',
    [
      'Coaches are approved before they get coach tools. Lessons are checked by a second coach before they go live.',
      'Coaches are responsible for the programs and feedback they give, and must not ask athletes for payment outside FitSphere once payments are offered here.',
    ],
  ],
  [
    'Fair use',
    [
      'Do not misuse the service, harass others, upload content you have no right to share, or try to reach data that is not yours.',
      'We may suspend accounts that break these terms.',
    ],
  ],
  [
    'Changes',
    ['We may update these terms as the service grows. The date below changes when we do.'],
  ],
];

export default function TermsPage() {
  return (
    <main className="mx-auto flex w-full max-w-[760px] flex-col gap-6 px-4 pb-20 pt-8 md:px-10">
      <h1 className="m-0 font-display text-[48px] font-normal uppercase leading-[0.95]">Terms of use</h1>
      <p className="m-0 text-[15px] text-muted">Last updated 19 November 2026.</p>
      {sections.map(([title, items]) => (
        <section key={title} aria-labelledby={title} className="flex flex-col gap-2">
          <h2 id={title} className="m-0 text-[20px] font-semibold">
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
        See also the <Link href="/legal/privacy" className="underline">privacy policy</Link>.
      </p>
    </main>
  );
}
