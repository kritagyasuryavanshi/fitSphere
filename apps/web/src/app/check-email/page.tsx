import { normaliseEmail } from '@fitsphere/core';
import { buttonClass } from '@fitsphere/ui';
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { AuthHeading, AuthShell } from '../auth-shell';
import { ResendButton } from './resend-button';

export const metadata: Metadata = { title: 'Check your email · FitSphere' };

async function SentTo({ searchParams }: { searchParams: PageProps<'/check-email'>['searchParams'] }) {
  const { email: raw } = await searchParams;
  const email = typeof raw === 'string' ? normaliseEmail(raw) : null;
  if (!email) redirect('/sign-in');

  return (
    <>
      <p className="m-0 max-w-[62ch] text-[16px] leading-[1.6] text-ink-soft">
        We sent a sign-in link to <strong className="text-ink">{email}</strong>. It works for 15 minutes. Open it on this phone or computer.
      </p>
      <Link href="/" className={buttonClass()}>
        I opened the link
      </Link>
      <ResendButton email={email} />
    </>
  );
}

export default function CheckEmailPage({ searchParams }: PageProps<'/check-email'>) {
  return (
    <AuthShell back={{ href: '/sign-in', label: 'Use a different email' }}>
      <span className="flex h-16 w-16 items-center justify-center rounded-full bg-volt text-ink">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" aria-hidden="true">
          <path d="M5 12.5l4.5 4.5L19 7.5" />
        </svg>
      </span>
      <AuthHeading>Check your email</AuthHeading>
      <Suspense fallback={null}>
        <SentTo searchParams={searchParams} />
      </Suspense>
      <p className="m-0 text-[13px] text-muted">Nothing yet? Check spam, or the Promotions tab in Gmail.</p>
    </AuthShell>
  );
}
