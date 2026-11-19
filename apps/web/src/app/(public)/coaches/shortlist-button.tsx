'use client';

import { buttonClass } from '@fitsphere/ui';
import Link from 'next/link';
import { useActionState } from 'react';
import { toggleShortlist } from './actions';

/** Shortlist on or off. A guest is sent to sign in, since a shortlist belongs to an account. */
export function ShortlistButton({ coachId, on, signedIn, name }: { coachId: string; on: boolean; signedIn: boolean; name: string }) {
  const [state, action, pending] = useActionState(toggleShortlist, {});
  if (!signedIn) {
    return (
      <Link href="/sign-in" className={buttonClass({ variant: 'light', size: 'small' })}>
        Shortlist
        <span className="sr-only"> {name}</span>
      </Link>
    );
  }
  return (
    <form action={action} className="flex flex-col gap-1">
      <input type="hidden" name="coach" value={coachId} />
      <input type="hidden" name="on" value={on ? 'false' : 'true'} />
      <button type="submit" disabled={pending} aria-pressed={on} className={buttonClass({ variant: on ? 'ink' : 'light', size: 'small' })}>
        {on ? 'Shortlisted' : 'Shortlist'}
        <span className="sr-only"> {name}</span>
      </button>
      {state.error ? (
        <p role="status" className="m-0 text-[13px] text-danger">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
