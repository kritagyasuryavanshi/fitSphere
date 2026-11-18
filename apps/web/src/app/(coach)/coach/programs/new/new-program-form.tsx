'use client';

import { Button, Input } from '@fitsphere/ui';
import { useActionState } from 'react';
import { useHydrated } from '@/lib/use-hydrated';
import { createProgram } from '../actions';

export function NewProgramForm({ categories }: { categories: { id: string; name: string }[] }) {
  const [state, action, pending] = useActionState(createProgram, {});
  const hydrated = useHydrated();
  return (
    <form action={action} noValidate className="flex flex-col gap-6">
      <Input label="Program name" name="title" maxLength={120} error={state.field === 'title' ? state.error : undefined} />
      <label className="flex flex-col gap-2 text-[15px] font-medium">
        Main sport
        <select name="category" defaultValue={categories[0]?.id} className="min-h-12 border border-line-strong bg-paper px-3 text-[16px] font-normal">
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <span className="text-[14px] font-normal text-muted">Sessions can still mix drills and exercises from every sport.</span>
      </label>
      {state.error && state.field !== 'title' ? (
        <p role="alert" className="m-0 text-[14px] font-medium text-danger">
          {state.error}
        </p>
      ) : null}
      <Button type="submit" disabled={!hydrated || pending} className="self-start">
        Start building
      </Button>
    </form>
  );
}
