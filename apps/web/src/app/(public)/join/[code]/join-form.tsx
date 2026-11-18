'use client';

import { Button } from '@fitsphere/ui';
import { useActionState } from 'react';
import { useHydrated } from '@/lib/use-hydrated';
import { joinProgram } from './actions';

export function JoinForm({ code }: { code: string }) {
  const [state, action, pending] = useActionState(joinProgram, {});
  const hydrated = useHydrated();
  return (
    <form action={action} className="flex flex-col items-start gap-3">
      <input type="hidden" name="code" value={code} />
      <Button type="submit" variant="volt" disabled={!hydrated || pending}>
        Join program
      </Button>
      {state.error ? (
        <p role="alert" className="m-0 text-[15px] font-medium text-danger">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
