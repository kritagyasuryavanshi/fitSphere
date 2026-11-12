import { buttonClass } from '@fitsphere/ui';
import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = { title: 'Application sent · FitSphere' };

// P-Applied. The mockup's [REPLY TIME] is an owner decision; until it is set, the copy makes no promise of a time.
export default function AppliedPage() {
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-5 px-4 py-16 md:px-10">
      <span className="flex size-16 items-center justify-center rounded-full bg-volt text-ink">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" aria-hidden="true">
          <path d="M5 12.5l4.5 4.5L19 7.5" />
        </svg>
      </span>
      <h1 className="m-0 font-display text-[48px] font-normal uppercase leading-[0.95] md:text-[64px]">Application sent.</h1>
      <p className="m-0 text-[16px] leading-[1.6] text-ink-soft">
        Thanks. We read every application and reply by email. If you are a fit, an admin turns on your coach tools.
      </p>
      <Link href="/" className={`${buttonClass()} self-start`}>
        Back to home
      </Link>
    </main>
  );
}
