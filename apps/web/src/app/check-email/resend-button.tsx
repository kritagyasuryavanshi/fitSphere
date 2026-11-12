'use client';

import { Button } from '@fitsphere/ui';
import { useEffect, useState, useTransition } from 'react';
import { resendLink } from '../sign-in/actions';

const WAIT_SECONDS = 60;

export function ResendButton({ email }: { email: string }) {
  // A deadline, not a chain of timeouts, so a throttled background tab still counts real time.
  const [until, setUntil] = useState(() => Date.now() + WAIT_SECONDS * 1000);
  const [left, setLeft] = useState(WAIT_SECONDS);
  const [message, setMessage] = useState<string>();
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    const tick = () => setLeft(Math.max(0, Math.ceil((until - Date.now()) / 1000)));
    tick();
    const timer = setInterval(tick, 250);
    return () => clearInterval(timer);
  }, [until]);

  const resend = () =>
    startTransition(async () => {
      const error = await resendLink(email);
      setMessage(error ?? 'We sent a new link.');
      if (!error) setUntil(Date.now() + WAIT_SECONDS * 1000);
    });

  const clock = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
  return (
    <>
      <Button variant="light" disabled={left > 0 || pending} onClick={resend}>
        {left > 0 ? `Resend link in ${clock}` : 'Resend link'}
      </Button>
      <p role="status" className="m-0 min-h-5 text-[14px] font-medium">
        {message}
      </p>
    </>
  );
}
