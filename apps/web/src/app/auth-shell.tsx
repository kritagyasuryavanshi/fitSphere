import Link from 'next/link';
import type { ReactNode } from 'react';
import { SportsVideo } from '@/components/sports-video';

type ShellProps = {
  back: { href: string; label: string };
  children: ReactNode;
  slogan?: string;
  /** Shown opposite the back link, like "Step 1 of 4". A step screen starts at the top instead of the middle. */
  step?: { now: number; of: number };
};

/**
 * The video panel and form column shared by the sign-in and sign-up screens. The montage shows every live sport,
 * so no one sport fronts sign-in. On a phone the form is a sheet over the video; a step screen keeps a short strip.
 */
export function AuthShell({ back, children, slogan = 'Train with a plan.', step }: ShellProps) {
  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <section
        className={`relative shrink-0 overflow-hidden bg-ink md:sticky md:top-0 md:h-screen md:flex-1 ${step ? 'h-[200px]' : 'h-[46vh] min-h-[300px]'}`}
      >
        <SportsVideo />
        <div aria-hidden="true" className="absolute inset-0 bg-linear-to-b from-black/55 via-black/10 to-black/75" />
        <Link href="/" className="absolute left-5 top-5 font-display text-[28px] uppercase text-paper hover:text-paper md:left-10 md:top-8">
          FitSphere
        </Link>
        <div className={`absolute left-5 right-5 md:bottom-12 md:left-10 md:right-10 ${step ? 'bottom-5' : 'bottom-12'}`}>
          <p aria-hidden="true" className="m-0 font-display text-[clamp(44px,6vw,104px)] uppercase leading-[0.9] text-paper">
            {slogan}
          </p>
          <p className="m-0 mt-4 hidden text-[15px] font-medium text-paper/80 md:block">Boxing · Strength &amp; conditioning · Gym</p>
        </div>
      </section>
      <main
        className={`relative z-10 box-border flex min-w-0 flex-1 flex-col bg-paper px-5 pb-5 md:mt-0 md:rounded-none md:px-14 md:pb-14 md:pt-10 ${step ? 'pt-4' : '-mt-6 rounded-t-[28px] pt-6'}`}
      >
        <div className="flex items-center justify-between gap-4">
          <Link href={back.href} className="inline-flex min-h-11 items-center gap-1.5 text-[15px] font-medium">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
              <path d="M15 5l-7 7 7 7" />
            </svg>
            {back.label}
          </Link>
          {step ? <span className="text-[14px] font-medium text-muted">Step {step.now} of {step.of}</span> : null}
        </div>
        {step ? (
          <>
            <div role="progressbar" aria-label="Sign-up progress" aria-valuenow={step.now} aria-valuemin={0} aria-valuemax={step.of} className="mt-3 grid gap-1" style={{ gridTemplateColumns: `repeat(${step.of}, minmax(0, 1fr))` }}>
              {Array.from({ length: step.of }, (_, i) => (
                <span key={i} className={`h-1 ${i < step.now ? 'bg-ink' : 'bg-line'}`} />
              ))}
            </div>
            <div className="mt-10 flex w-full max-w-[640px] flex-col gap-5">{children}</div>
          </>
        ) : (
          <div className="flex w-full max-w-[480px] flex-col gap-6 pt-6 md:my-auto md:pt-12">{children}</div>
        )}
      </main>
    </div>
  );
}

export function AuthHeading({ children }: { children: ReactNode }) {
  return <h1 className="m-0 font-display text-[48px] font-normal uppercase leading-[0.9] md:text-[64px]">{children}</h1>;
}
