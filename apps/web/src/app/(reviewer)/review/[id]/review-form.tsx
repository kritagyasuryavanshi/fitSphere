'use client';

import { Button } from '@fitsphere/ui';
import { useActionState, useState } from 'react';
import { useHydrated } from '@/lib/use-hydrated';
import { FieldError, TextArea } from '../../../welcome/fields';
import { reviewItem } from '../actions';
import { reviewChecks } from '../checks';

/** Approve stays disabled until every check is ticked. Send back needs a note, which the author sees. */
export function ReviewForm({ itemId, authorName }: { itemId: string; authorName: string }) {
  const [state, action, pending] = useActionState(reviewItem, {});
  const hydrated = useHydrated();
  const [ticked, setTicked] = useState<string[]>([]);
  const all = ticked.length === reviewChecks.length;

  return (
    <form action={action} noValidate className="flex flex-col gap-4">
      <input type="hidden" name="item" value={itemId} />
      <fieldset className="m-0 flex flex-col border-0 p-0">
        <legend className="pb-2 text-[18px] font-medium">Your checks</legend>
        {reviewChecks.map((c) => (
          <label key={c} className="flex min-h-11 items-center gap-2.5 text-[15px]">
            <input
              type="checkbox"
              name="check"
              value={c}
              checked={ticked.includes(c)}
              onChange={(e) => setTicked(e.target.checked ? [...ticked, c] : ticked.filter((x) => x !== c))}
              className="size-[18px] accent-ink"
            />
            {c}
          </label>
        ))}
      </fieldset>
      <TextArea label={`Note to ${authorName}`} name="note" rows={3} maxLength={1000} error={state.field === 'note' ? state.error : undefined} />
      <Button type="submit" name="decision" value="approve" disabled={!hydrated || pending || !all}>
        Approve and publish
      </Button>
      {!all ? <p className="m-0 text-[14px] text-muted">Tick every check to publish.</p> : null}
      <Button type="submit" name="decision" value="send_back" variant="light" disabled={!hydrated || pending}>
        Send back with note
      </Button>
      {state.error && state.field !== 'note' ? <FieldError id="review-error">{state.error}</FieldError> : null}
    </form>
  );
}
