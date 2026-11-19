'use client';

import { Button, Input } from '@fitsphere/ui';
import { useActionState } from 'react';
import { useHydrated } from '@/lib/use-hydrated';
import { requestCoaching } from './actions';

type Pkg = { id: string; title: string; price: string; per: string };

export function HireForm({ coachName, packages, today, latest }: { coachName: string; packages: Pkg[]; today: string; latest: string }) {
  const hydrated = useHydrated();
  const [state, action, pending] = useActionState(requestCoaching, {});
  const f = state.fields;
  return (
    // key: a refused request re-mounts the fields with what was typed.
    <form key={f ? JSON.stringify(f) : 'new'} action={action} aria-label={`Hire ${coachName}`} className="flex flex-col gap-6">
      <fieldset className="m-0 flex flex-col gap-3 border-0 p-0">
        <legend className="mb-2 text-[18px] font-semibold">Package</legend>
        {packages.map((k, i) => (
          <label key={k.id} className="flex min-h-11 items-start gap-3 border border-line p-4 text-[16px] has-[:checked]:border-ink">
            <input type="radio" name="package" value={k.id} required defaultChecked={f ? f.package === k.id : i === 0} className="mt-1 size-[18px] accent-ink" />
            <span className="flex flex-col">
              <span className="font-medium">{k.title}</span>
              <span className="text-muted">
                {k.price} {k.per}
              </span>
            </span>
          </label>
        ))}
      </fieldset>
      <div className="grid gap-4 md:grid-cols-2">
        <Input label="Start date" name="start" type="date" min={today} max={latest} required defaultValue={f?.start ?? today} />
        <label className="flex flex-col gap-2 text-[15px] font-medium">
          Days you can train
          <select name="days" defaultValue={f?.days ?? '3'} className="min-h-12 border border-line-strong bg-paper px-3 text-[16px] font-normal">
            {[1, 2, 3, 4, 5, 6, 7].map((d) => (
              <option key={d} value={d}>
                {d} {d === 1 ? 'day' : 'days'} a week
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="flex flex-col gap-2 text-[15px] font-medium">
        What do you want from coaching?
        <textarea name="goals" rows={5} maxLength={1000} defaultValue={f?.goals ?? ''} className="resize-y border border-line-strong p-3 text-[16px] font-normal" />
        <span className="text-[13px] font-normal text-muted">{coachName} reads this before accepting. Mention any injury.</span>
      </label>
      <label className="flex min-h-11 items-start gap-3 text-[15px]">
        <input type="checkbox" name="share" defaultChecked={f ? f.share === 'on' : true} className="mt-0.5 size-[18px] accent-ink" />
        Share my training logs and sign-up answers with {coachName} while I am their client.
      </label>
      {state.error ? (
        <p role="status" className="m-0 text-[15px] font-medium text-danger">
          {state.error}
        </p>
      ) : null}
      <div className="flex flex-col gap-2">
        <Button type="submit" disabled={!hydrated || pending} className="self-start">
          {pending ? 'Sending…' : 'Send request'}
        </Button>
        <p className="m-0 text-[14px] text-muted">You pay only after {coachName} accepts.</p>
      </div>
    </form>
  );
}
