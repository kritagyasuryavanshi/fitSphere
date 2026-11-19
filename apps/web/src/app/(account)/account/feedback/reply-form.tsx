'use client';

import { Button } from '@fitsphere/ui';
import { useActionState, useEffect, useRef } from 'react';
import { useHydrated } from '@/lib/use-hydrated';
import { replyFeedback } from './actions';

export function ReplyForm({ feedback, coach }: { feedback: string; coach: string }) {
  const hydrated = useHydrated();
  const [state, action, pending] = useActionState(replyFeedback, {});
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.sent) form.current?.reset();
  }, [state.sent]);
  return (
    <form ref={form} action={action} className="flex flex-col gap-2">
      <input type="hidden" name="feedback" value={feedback} />
      <label className="flex flex-col gap-2 text-[15px] font-medium">
        Reply to {coach}
        <textarea name="body" rows={3} maxLength={1000} required className="resize-y border border-line-strong p-3 text-[15px] font-normal" />
      </label>
      <p role="status" className={`m-0 min-h-5 text-[14px] ${state.error ? 'font-medium text-danger' : 'text-success'}`}>
        {state.error ?? (state.sent ? 'Reply sent.' : '')}
      </p>
      <Button type="submit" variant="light" disabled={!hydrated || pending} className="self-start">
        {pending ? 'Sending…' : 'Send reply'}
      </Button>
    </form>
  );
}
