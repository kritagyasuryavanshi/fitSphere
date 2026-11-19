'use client';

import { buttonClass } from '@fitsphere/ui';
import { useActionState } from 'react';
import { decideRequest } from './actions';

/** Accept and Decline for one request. Each names the athlete for screen readers, since a list has many. */
export function DecideForm({ engagementId, athlete }: { engagementId: string; athlete: string }) {
  const [state, action, pending] = useActionState(decideRequest, {});
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="engagement" value={engagementId} />
      <div className="flex flex-wrap gap-2">
        <button type="submit" name="accept" value="true" disabled={pending} className={buttonClass({ size: 'small' })}>
          Accept<span className="sr-only"> {athlete}</span>
        </button>
        <button type="submit" name="accept" value="false" disabled={pending} className={buttonClass({ variant: 'light', size: 'small' })}>
          Decline<span className="sr-only"> {athlete}</span>
        </button>
      </div>
      {state.error ? (
        <p role="status" className="m-0 text-[14px] font-medium text-danger">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
