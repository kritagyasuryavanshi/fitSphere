import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { AuthHeading, AuthShell } from '../auth-shell';
import { SignInForm } from './sign-in-form';

export const metadata: Metadata = { title: 'Log in or join · FitSphere' };

const errors: Record<string, string> = {
  link: 'That link has expired, was already used, or was opened in a different browser. Send a new one here.',
  google: 'Google sign-in did not work. Try again, or use your email.',
};

// Only the message from the URL streams in at request time. The form itself stays in the static page:
// if it streamed in too, it would replace an early copy of itself and drop what the person had typed.
async function LinkError({ searchParams }: { searchParams: PageProps<'/sign-in'>['searchParams'] }) {
  const { error } = await searchParams;
  const message = typeof error === 'string' && Object.hasOwn(errors, error) ? errors[error] : undefined;
  return message ? (
    <p role="alert" className="m-0 border-l-4 border-danger bg-danger-soft px-4 py-3 text-[15px] font-medium text-danger">
      {message}
    </p>
  ) : null;
}

export default function SignInPage({ searchParams }: PageProps<'/sign-in'>) {
  return (
    <AuthShell back={{ href: '/', label: 'Home' }}>
      <AuthHeading>Log in or join</AuthHeading>
      <p className="m-0 max-w-[62ch] text-[16px] leading-[1.6] text-ink-soft">
        We email you a sign-in link. No password to remember. New here? The same link creates your account.
      </p>
      <Suspense fallback={null}>
        <LinkError searchParams={searchParams} />
      </Suspense>
      <SignInForm />
      <p className="m-0 text-[13px] leading-[1.5] text-muted">
        By continuing you agree to the <Link href="/terms" className="underline">terms</Link> and{' '}
        <Link href="/privacy" className="underline">privacy policy</Link>.
      </p>
    </AuthShell>
  );
}
