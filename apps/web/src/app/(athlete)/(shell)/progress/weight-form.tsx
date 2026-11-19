'use client';

import { Button, Input } from '@fitsphere/ui';
import { useActionState } from 'react';
import { useHydrated } from '@/lib/use-hydrated';
import { logWeight } from './actions';

export function WeightForm() {
  const hydrated = useHydrated();
  const [state, action, pending] = useActionState(logWeight, {});
  return (
    <form action={action} noValidate className="flex flex-col gap-3">
      <Input label="Today's weight (kg)" name="weight" inputMode="decimal" autoComplete="off" error={state.error} />
      <p role="status" className="m-0 min-h-5 text-[14px] text-success">
        {state.saved ? `Saved ${state.saved} kg for today.` : ''}
      </p>
      <Button type="submit" variant="light" disabled={!hydrated || pending} className="self-start">
        {pending ? 'Saving…' : 'Log weight'}
      </Button>
    </form>
  );
}
