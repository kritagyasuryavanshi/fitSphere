'use client';

import { Button } from '@fitsphere/ui';
import { useActionState } from 'react';
import { useHydrated } from '@/lib/use-hydrated';
import { ask, type AskState } from './actions';

export function AskForm({ left, limit }: { left: number; limit: number }) {
  const hydrated = useHydrated();
  const [state, action, pending] = useActionState<AskState, FormData>(ask, {});
  return (
    <>
      {state.answer ? (
        <p role="status" className="m-0 border-l-4 border-warning bg-warning-soft p-3 text-[15px]">
          {state.answer.text}
        </p>
      ) : null}
      {/* key: a refused question re-mounts the box with what was typed. */}
      <form key={state.draft ?? 'new'} action={action} aria-label="Ask the AI guide" className="flex flex-col gap-2">
        <label className="flex flex-col gap-2 text-[15px] font-medium">
          Your question
          <textarea name="question" rows={3} maxLength={500} required defaultValue={state.draft ?? ''} className="resize-y border border-line-strong p-3 text-[16px] font-normal" />
        </label>
        {state.error ? (
          <p role="status" className="m-0 text-[14px] font-medium text-danger">
            {state.error}
          </p>
        ) : null}
        <Button type="submit" disabled={!hydrated || pending || left === 0} className="self-start">
          {pending ? 'Thinking…' : 'Ask'}
        </Button>
        <p className="m-0 text-[13px] text-muted">
          {left} of {limit} questions left today · AI can make mistakes. Coach-verified lessons are the source of truth.
        </p>
      </form>
    </>
  );
}
