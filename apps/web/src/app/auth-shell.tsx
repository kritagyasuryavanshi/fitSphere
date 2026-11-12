import Image from 'next/image';
import Link from 'next/link';
import type { ReactNode } from 'react';

/** The photo panel and form column shared by the sign-in screens (A-SignIn, A-CheckEmail). */
export function AuthShell({ back, children }: { back: { href: string; label: string }; children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-wrap">
      <section className="relative min-h-[322px] flex-[1_1_480px] overflow-hidden bg-ink md:min-h-[520px]">
        <Image src="/images/gloves-black.jpg" alt="Black boxing gloves hanging in a gym" fill priority sizes="(min-width: 1040px) 50vw, 100vw" className="object-cover" />
        <div aria-hidden="true" className="absolute inset-0 bg-black/40" />
        <Link href="/" className="absolute left-10 top-8 font-display text-[28px] uppercase text-paper hover:text-paper">
          FitSphere
        </Link>
        <p aria-hidden="true" className="absolute bottom-12 left-10 right-10 m-0 font-display text-[clamp(56px,6vw,104px)] uppercase leading-[0.9] text-paper">
          Glove up.
        </p>
      </section>
      <main className="box-border flex min-w-0 flex-[1_1_560px] flex-col px-5 pb-5 pt-4 md:px-14 md:pb-14 md:pt-10">
        <Link href={back.href} className="inline-flex min-h-11 items-center gap-1.5 self-start text-[15px] font-medium">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
            <path d="M15 5l-7 7 7 7" />
          </svg>
          {back.label}
        </Link>
        <div className="my-auto flex w-full max-w-[480px] flex-col gap-6 pt-12">{children}</div>
      </main>
    </div>
  );
}

export function AuthHeading({ children }: { children: ReactNode }) {
  return <h1 className="m-0 font-display text-[48px] font-normal uppercase leading-[0.9] md:text-[64px]">{children}</h1>;
}
