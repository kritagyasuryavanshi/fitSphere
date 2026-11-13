'use client';

import { Button, Input } from '@fitsphere/ui';
import { useActionState } from 'react';
import { useHydrated } from '@/lib/use-hydrated';
import { saveName } from './actions';

export function NameForm({ name }: { name: string }) {
  const [state, action, pending] = useActionState(saveName, {});
  const hydrated = useHydrated();
  return (
    <form action={action} noValidate className="flex flex-wrap items-end gap-3">
      <div className="min-w-[240px] flex-1">
        <Input label="First name" name="name" autoComplete="given-name" maxLength={80} defaultValue={state.name ?? name} error={state.error} />
      </div>
      <Button type="submit" variant="light" disabled={pending || !hydrated}>
        {pending ? 'Saving…' : 'Save name'}
      </Button>
      <p role="status" className="m-0 w-full text-[14px] font-medium">
        {state.message}
      </p>
    </form>
  );
}
