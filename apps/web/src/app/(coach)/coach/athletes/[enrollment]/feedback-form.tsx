'use client';

import { Button } from '@fitsphere/ui';
import { useActionState, useEffect, useRef } from 'react';
import { useHydrated } from '@/lib/use-hydrated';
import { giveFeedback } from './actions';

export function FeedbackForm({ enrollment, name }: { enrollment: string; name: string }) {
  const hydrated = useHydrated();
  const [state, action, pending] = useActionState(giveFeedback, {});
  const form = useRef<HTMLFormElement>(null);
  // Clear the box only after a send; a refused one keeps the text to fix.
  useEffect(() => {
    if (state.sent) form.current?.reset();
  }, [state.sent]);
  return (
    <form ref={form} action={action} className="flex flex-col gap-3">
      <input type="hidden" name="enrollment" value={enrollment} />
      <label className="flex flex-col gap-2 text-[15px] font-medium">
        Feedback for {name}
        <textarea name="body" rows={5} maxLength={2000} required className="resize-y border border-line-strong p-3 text-[15px] font-normal" />
      </label>
      <p role="status" className={`m-0 min-h-5 text-[14px] ${state.error ? 'font-medium text-danger' : 'text-success'}`}>
        {state.error ?? (state.sent ? `Sent. ${name} sees it on Today and in Coach feedback.` : '')}
      </p>
      <Button type="submit" disabled={!hydrated || pending} className="self-start">
        {pending ? 'Sending…' : `Send to ${name}`}
      </Button>
    </form>
  );
}
