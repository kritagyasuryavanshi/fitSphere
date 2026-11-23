import { buttonClass } from '@fitsphere/ui';
import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';

export const metadata: Metadata = { title: 'About · FitSphere', description: 'One place to learn, practise and be coached.' };

// P-About (M6-01). The rules are the ones the code enforces; keep them in step.
const rules: [string, string][] = [
  ['A second coach checks every lesson', 'before anyone sees it.'],
  ['Adults only for now.', 'A version for young athletes needs parental consent first.'],
  ['Your coach sees your data only while you train with them.', 'Leave, and access ends.'],
  ['No advertising, and we do not sell your data.', 'The privacy policy says what we keep and why.'],
];

export default function AboutPage() {
  return (
    <main className="flex flex-col">
      <section className="mx-auto w-full max-w-[1440px] px-4 py-14 md:px-10">
        <h1 className="m-0 max-w-[1000px] font-display text-[56px] font-normal uppercase leading-[0.92] md:text-[96px]">One place to learn, practise and be coached.</h1>
      </section>
      <div className="relative h-[320px] md:h-[480px]">
        <Image src="/images/coach-ring.jpg" alt="A coach leaning on the ring ropes" fill sizes="100vw" className="object-cover" />
      </div>
      <div className="mx-auto flex w-full max-w-[760px] flex-col gap-10 px-4 py-14 md:px-10">
        <section aria-labelledby="problem" className="flex flex-col gap-3">
          <h2 id="problem" className="m-0 text-[28px] font-semibold">
            The problem
          </h2>
          <p className="m-0 text-[18px] leading-[1.6] text-ink-soft">
            Today you learn from random videos, train from a fitness app, hear from your coach on WhatsApp, and track progress from memory. Nothing connects them.
          </p>
        </section>
        <section aria-labelledby="rules" className="flex flex-col gap-3">
          <h2 id="rules" className="m-0 text-[28px] font-semibold">
            Our rules
          </h2>
          <ul className="m-0 flex flex-col gap-2 pl-5 text-[18px] leading-[1.6] text-ink-soft">
            {rules.map(([strong, rest]) => (
              <li key={strong}>
                <strong className="text-ink">{strong}</strong> {rest}
              </li>
            ))}
          </ul>
        </section>
        <section aria-label="Get started" className="flex flex-col gap-4 border-t border-line pt-10">
          <p className="m-0 font-display text-[40px] uppercase leading-none">Start with the jab.</p>
          <div className="flex flex-wrap gap-3">
            <Link href="/sign-in" className={buttonClass()}>
              Join free
            </Link>
            <Link href="/learn/boxing" className={buttonClass({ variant: 'light' })}>
              Browse lessons
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
