'use client';

import { Button } from '@fitsphere/ui';
import { useActionState } from 'react';
import { useHydrated } from '@/lib/use-hydrated';
import { decideCredential } from './actions';

export function DecisionForm({ credential, title }: { credential: string; title: string }) {
  const hydrated = useHydrated();
  const [state, action, pending] = useActionState(decideCredential, {});
  return (
    <form action={action} aria-label={`Decide: ${title}`} className="flex flex-col gap-2">
      <input type="hidden" name="credential" value={credential} />
      <label className="flex flex-col gap-1 text-[14px] font-medium">
        Note for the coach (needed to reject)
        <textarea name="note" rows={2} maxLength={500} className="resize-y border border-line-strong p-2 text-[15px] font-normal" />
      </label>
      <p role="status" className="m-0 min-h-5 text-[14px] font-medium text-danger">
        {state.error ?? ''}
      </p>
      <div className="flex flex-wrap gap-3">
        <Button type="submit" name="decision" value="check" disabled={!hydrated || pending}>
          Mark checked
        </Button>
        <Button type="submit" name="decision" value="reject" variant="light" disabled={!hydrated || pending}>
          Reject with note
        </Button>
      </div>
    </form>
  );
}
