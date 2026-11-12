'use client';

import { Button, Checkbox } from '@fitsphere/ui';
import { useActionState } from 'react';
import { useHydrated } from '@/lib/use-hydrated';
import { saveRoles } from './actions';

export type Person = { id: string; name: string; email: string; roles: string[]; joined: string; self: boolean };

const ROLES = [
  ['athlete', 'Athlete'],
  ['coach', 'Coach'],
  ['reviewer', 'Reviewer'],
  ['admin', 'Admin'],
] as const;

export function PeopleTable({ people }: { people: Person[] }) {
  const [state, action, pending] = useActionState(saveRoles, {});
  const hydrated = useHydrated();

  return (
    // Keyed on the saved roles, so after a save the boxes show what the database now holds.
    <form action={action} key={people.map((p) => `${p.id}:${p.roles.join()}`).join('|')} className="flex flex-col gap-4">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse text-left text-[15px]">
          <thead>
            <tr className="border-b border-line-strong text-[14px] text-muted">
              <th scope="col" className="py-3 pr-4 font-medium">Name</th>
              <th scope="col" className="py-3 pr-4 font-medium">Email</th>
              <th scope="col" className="py-3 pr-4 font-medium">Roles</th>
              <th scope="col" className="py-3 font-medium">Joined</th>
            </tr>
          </thead>
          <tbody>
            {people.map((person) => (
              <tr key={person.id} className="border-b border-line align-top">
                <td className="py-3 pr-4 font-medium">
                  {person.name || '—'}
                  {person.self ? <span className="block text-[13px] font-normal text-muted">You</span> : null}
                </td>
                <td className="py-3 pr-4">{person.email}</td>
                <td className="py-1 pr-4">
                  {/* The admin's own row sends nothing: its boxes are disabled, and nobody changes their own roles. */}
                  {person.self ? null : (
                    <>
                      <input type="hidden" name="person" value={person.id} />
                      <input type="hidden" name={`before:${person.id}`} value={person.roles.join(',')} />
                      <input type="hidden" name={`name:${person.id}`} value={person.name || person.email} />
                    </>
                  )}
                  <fieldset className="m-0 flex flex-wrap gap-x-4 border-0 p-0" disabled={person.self}>
                    <legend className="sr-only">Roles for {person.name || person.email}</legend>
                    {ROLES.map(([value, label]) => (
                      <Checkbox key={value} name={`roles:${person.id}`} value={value} label={label} defaultChecked={person.roles.includes(value)} />
                    ))}
                  </fieldset>
                </td>
                <td className="whitespace-nowrap py-3">{person.joined}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {people.length === 0 ? <p className="m-0 text-[15px] text-muted">Nobody matches that search.</p> : null}

      <div className="flex flex-wrap items-center gap-4">
        <Button type="submit" disabled={pending || !hydrated}>
          {pending ? 'Saving…' : 'Save role changes'}
        </Button>
        <span className="text-[14px] text-muted">A person cannot change their own role.</span>
      </div>
      <div role="status" className="flex flex-col gap-1 text-[14px] font-medium">
        {state.message ? <p className="m-0">{state.message}</p> : null}
        {state.errors?.map((error, i) => (
          <p key={i} className="m-0 text-danger">
            {error}
          </p>
        ))}
      </div>
    </form>
  );
}
