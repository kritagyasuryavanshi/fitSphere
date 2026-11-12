import { buttonClass } from '@fitsphere/ui';
import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = { title: 'Not allowed · FitSphere' };

// Where requireRole sends a signed-in person who opens a page their role does not cover.
export default function NotAllowedPage() {
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-5 px-4 py-16 md:px-10">
      <h1 className="m-0 font-display text-[48px] font-normal uppercase leading-[0.95] md:text-[64px]">Not for your account</h1>
      <p className="m-0 text-[16px] leading-[1.6] text-ink-soft">This page is for a different kind of account, like coaches or admins. If you think you should see it, ask the person who runs FitSphere.</p>
      <Link href="/" className={`${buttonClass()} self-start`}>
        Back to home
      </Link>
    </main>
  );
}
