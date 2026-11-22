import Image from 'next/image';
import type { ReactNode } from 'react';

// P-NotFound: the dark photo hero that the 404 and error pages share.
export function ErrorHero({ eyebrow, title, body, children }: { eyebrow: string; title: string; body: string; children: ReactNode }) {
  return (
    <main className="relative flex min-h-[560px] flex-1 items-end overflow-hidden bg-ink text-paper md:min-h-[680px]">
      <Image src="/images/heavybag.jpg" alt="" fill priority sizes="100vw" className="object-cover opacity-45" />
      <div className="relative mx-auto flex w-full max-w-[1440px] flex-col gap-6 px-4 pb-14 md:px-10 md:pb-[72px]">
        <p className="m-0 text-[16px] font-medium text-line-strong">{eyebrow}</p>
        <h1 className="m-0 max-w-[1000px] font-display text-[64px] font-normal uppercase leading-[0.9] md:text-[clamp(64px,9vw,140px)]">{title}</h1>
        <p className="m-0 max-w-[520px] text-[18px] leading-[1.5] text-mist">{body}</p>
        <div className="flex flex-wrap gap-3">{children}</div>
      </div>
    </main>
  );
}
