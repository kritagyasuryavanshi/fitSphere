'use client';

import { Button } from '@fitsphere/ui';
import { useRouter } from 'next/navigation';
import { useActionState, useEffect } from 'react';
import { useHydrated } from '@/lib/use-hydrated';
import { sendMessage } from '../actions';

/** Re-reads the conversation every 4 seconds while the tab is visible, so a new message shows within 10 seconds. */
// shortcut: polling, not Supabase Realtime; switch when conversations get busy enough for the extra requests to matter.
export function Refresher() {
  const router = useRouter();
  useEffect(() => {
    const t = setInterval(() => {
      if (document.visibilityState === 'visible') router.refresh();
    }, 4000);
    return () => clearInterval(t);
  }, [router]);
  return null;
}

export function SendForm({ conversationId, to }: { conversationId: string; to: string }) {
  const hydrated = useHydrated();
  const [state, action, pending] = useActionState(sendMessage, {});
  return (
    // key: a refused message re-mounts the box with what was typed; a sent one clears it.
    <form key={state.draft ?? String(state.sent ?? 'new')} action={action} aria-label="Send a message" className="flex flex-col gap-2">
      <input type="hidden" name="conversation" value={conversationId} />
      <label className="flex flex-col gap-2 text-[15px] font-medium">
        Message {to}
        <textarea name="body" rows={3} maxLength={2000} required defaultValue={state.draft ?? ''} className="resize-y border border-line-strong p-3 text-[16px] font-normal" />
      </label>
      {state.error ? (
        <p role="status" className="m-0 text-[14px] font-medium text-danger">
          {state.error}
        </p>
      ) : null}
      <Button type="submit" disabled={!hydrated || pending} className="self-start">
        {pending ? 'Sending…' : 'Send'}
      </Button>
    </form>
  );
}
