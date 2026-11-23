'use client';

import { Button, Input } from '@fitsphere/ui';
import { useActionState } from 'react';
import { Turnstile } from '@/components/turnstile';
import { useHydrated } from '@/lib/use-hydrated';
import { requestLink, signInWithGoogle } from './actions';

export function SignInForm() {
  const [state, action, pending] = useActionState(requestLink, {});
  const hydrated = useHydrated();

  return (
    <>
      {/* noValidate: the inline message from the mockup replaces the browser bubble. */}
      <form action={action} noValidate className="flex flex-col gap-6">
        <Input label="Email" name="email" type="email" autoComplete="email" inputMode="email" defaultValue={state.email} error={state.error} required />
        {/* A token works once: a refused send gets a fresh check. */}
        <Turnstile resetKey={state} />
        <Button type="submit" disabled={pending || !hydrated}>
          {pending ? 'Sending…' : 'Email me a link'}
        </Button>
      </form>
      <div className="flex items-center gap-3 text-[14px] text-muted">
        <span className="h-px flex-1 bg-line" />
        or
        <span className="h-px flex-1 bg-line" />
      </div>
      <form action={signInWithGoogle} className="flex flex-col">
        <Button type="submit" variant="light" disabled={!hydrated}>
          <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
            <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.2-2.1 3.5-5.1 3.5-8.7z" />
            <path fill="#34A853" d="M12 24c3.2 0 6-1.1 8-2.9l-3.9-3c-1.1.7-2.5 1.2-4.1 1.2-3.1 0-5.8-2.1-6.7-5H1.3v3.1A12 12 0 0 0 12 24z" />
            <path fill="#FBBC05" d="M5.3 14.3a7.2 7.2 0 0 1 0-4.6V6.6H1.3a12 12 0 0 0 0 10.8z" />
            <path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.3 6.6l4 3.1c.9-2.9 3.6-4.9 6.7-4.9z" />
          </svg>
          Continue with Google
        </Button>
      </form>
    </>
  );
}
