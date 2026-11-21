'use client';

import { buttonClass } from '@fitsphere/ui';
import { useActionState } from 'react';
import { assignProgram } from './actions';

/** Assign one of the coach's published programs to a paying client. */
export function AssignForm({
  engagementId,
  athlete,
  programs,
}: {
  engagementId: string;
  athlete: string;
  programs: { id: string; title: string }[];
}) {
  const [state, action, pending] = useActionState(assignProgram, {});
  if (!programs.length)
    return <span className="text-[14px] text-muted">Publish a program to assign it.</span>;
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="engagement" value={engagementId} />
      <label className="sr-only" htmlFor={`program-${engagementId}`}>
        Program for {athlete}
      </label>
      <select
        id={`program-${engagementId}`}
        name="program"
        className="min-h-11 border border-line-strong bg-paper px-2 text-[15px]"
      >
        {programs.map((p) => (
          <option key={p.id} value={p.id}>
            {p.title}
          </option>
        ))}
      </select>
      <button type="submit" disabled={pending} className={buttonClass({ variant: 'light', size: 'small' })}>
        Assign<span className="sr-only"> to {athlete}</span>
      </button>
      {state.error || state.done ? (
        <p role="status" className={`m-0 w-full text-[14px] font-medium ${state.error ? 'text-danger' : ''}`}>
          {state.error ?? (state.done === 'assigned' ? `Assigned. ${athlete} sees it in My programs.` : `${athlete} is already in this program.`)}
        </p>
      ) : null}
    </form>
  );
}
