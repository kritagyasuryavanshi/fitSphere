'use client';

import { Button, Input } from '@fitsphere/ui';
import { useActionState, useState, useTransition } from 'react';
import { useHydrated } from '@/lib/use-hydrated';
import { acceptAgreement, saveProfile, savePackage, saveSlots, setLive, type FormState } from './actions';

function Status({ state }: { state: FormState }) {
  return (
    <p role="status" className={`m-0 min-h-5 text-[14px] ${state.error ? 'font-medium text-danger' : 'text-success'}`}>
      {state.error ?? state.saved ?? ''}
    </p>
  );
}

export type ProfileValues = {
  headline: string;
  philosophy: string;
  specialties: string[];
  languages: string[];
  formats: string[];
  city: string;
  years: number;
  clientLimit: number;
};

export function ProfileForm({ values }: { values: ProfileValues }) {
  const hydrated = useHydrated();
  const [state, action, pending] = useActionState(saveProfile, {});
  const f = state.fields;
  const v = f
    ? { headline: f.headline ?? '', philosophy: f.philosophy ?? '', specialties: [f.specialties ?? ''], languages: [f.languages ?? ''], formats: (f.formats ?? '').split(','), city: f.city ?? '', years: Number(f.years || 0), clientLimit: Number(f.clientLimit || 0) }
    : values;
  return (
    // key: a failed save re-mounts the fields with what was typed.
    <form key={f ? JSON.stringify(f) : 'saved'} action={action} aria-label="About you" className="flex flex-col gap-4">
      <Input label="Headline" name="headline" maxLength={120} defaultValue={v.headline} placeholder="For example, boxing coach for beginners, 10 years" />
      <label className="flex flex-col gap-2 text-[15px] font-medium">
        How you coach
        <textarea name="philosophy" rows={4} maxLength={2000} defaultValue={v.philosophy} className="resize-y border border-line-strong p-3 text-[15px] font-normal" />
      </label>
      <Input label="Specialties (comma-separated)" name="specialties" defaultValue={v.specialties.join(', ')} placeholder="Boxing, Beginners, Footwork" />
      <Input label="Languages (comma-separated)" name="languages" defaultValue={v.languages.join(', ')} placeholder="English, Hindi" />
      <fieldset className="m-0 flex flex-wrap gap-5 border-0 p-0">
        <legend className="mb-2 text-[15px] font-medium">Formats</legend>
        {(
          [
            ['online', 'Online'],
            ['in_person', 'In person'],
          ] as const
        ).map(([fmt, label]) => (
          <label key={fmt} className="flex min-h-11 items-center gap-2 text-[15px]">
            <input type="checkbox" name="formats" value={fmt} defaultChecked={v.formats.includes(fmt)} />
            {label}
          </label>
        ))}
      </fieldset>
      <div className="grid gap-4 md:grid-cols-3">
        <Input label="City" name="city" maxLength={80} defaultValue={v.city} />
        <Input label="Years coaching" name="years" type="number" min={0} max={60} defaultValue={v.years} />
        <Input label="Client limit" name="clientLimit" type="number" min={1} max={100} defaultValue={v.clientLimit} />
      </div>
      <p className="m-0 text-[13px] text-muted">New hire requests pause when you reach your client limit.</p>
      <Status state={state} />
      <Button type="submit" disabled={!hydrated || pending} className="self-start">
        {pending ? 'Saving…' : 'Save profile'}
      </Button>
    </form>
  );
}

export function PackageForm({ pkg }: { pkg?: { id: string; title: string; kind: string; price: string; live: boolean } }) {
  const hydrated = useHydrated();
  const [state, action, pending] = useActionState(savePackage, {});
  const f = state.fields;
  const k = f ? { title: f.title ?? '', kind: f.kind ?? 'monthly', price: f.price ?? '', live: f.live === 'on' } : { title: pkg?.title ?? '', kind: pkg?.kind ?? 'monthly', price: pkg?.price ?? '', live: pkg?.live ?? true };
  return (
    <form key={f ? JSON.stringify(f) : (pkg?.id ?? 'new')} action={action} aria-label={pkg ? `Package: ${pkg.title}` : 'Add a package'} className="grid gap-3 border-b border-line py-3 md:grid-cols-[2fr_1fr_1fr_auto_auto] md:items-end">
      {pkg ? <input type="hidden" name="package" value={pkg.id} /> : null}
      <Input label="Package" name="title" maxLength={80} defaultValue={k.title} placeholder="Monthly coaching" />
      <label className="flex flex-col gap-2 text-[15px] font-medium">
        Type
        <select name="kind" defaultValue={k.kind} className="min-h-12 border border-line-strong px-3 text-[15px] font-normal">
          <option value="monthly">Monthly</option>
          <option value="single">One session</option>
        </select>
      </label>
      <Input label="Price ₹" name="price" inputMode="decimal" defaultValue={k.price} placeholder="4500" />
      <label className="flex min-h-12 items-center gap-2 text-[15px]">
        <input type="checkbox" name="live" defaultChecked={k.live} />
        Live
      </label>
      <Button type="submit" variant="light" disabled={!hydrated || pending}>
        {pkg ? 'Save' : 'Add'}
      </Button>
      <div className="md:col-span-5">
        <Status state={state} />
      </div>
    </form>
  );
}

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
type Slot = { dow: number; start: string; minutes: number };

export function SlotsEditor({ initial }: { initial: Slot[] }) {
  const hydrated = useHydrated();
  const [slots, setSlots] = useState(initial);
  const [state, setState] = useState<FormState>({});
  const [pending, start] = useTransition();
  const change = (i: number, patch: Partial<Slot>) => setSlots((s) => s.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  return (
    <div className="flex flex-col gap-3" role="group" aria-label="Weekly 1:1 slots">
      {slots.length ? null : <p className="m-0 text-[15px] text-muted">No weekly slots yet.</p>}
      {slots.map((s, i) => (
        <div key={i} className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-[14px] font-medium">
            Day
            <select value={s.dow} onChange={(e) => change(i, { dow: Number(e.target.value) })} className="min-h-11 border border-line-strong px-2 text-[15px] font-normal">
              {DAYS.map((d, n) => (
                <option key={d} value={n + 1}>
                  {d}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-[14px] font-medium">
            Start
            <input type="time" value={s.start} onChange={(e) => change(i, { start: e.target.value })} className="min-h-11 border border-line-strong px-2 text-[15px] font-normal" />
          </label>
          <label className="flex flex-col gap-1 text-[14px] font-medium">
            Minutes
            <select value={s.minutes} onChange={(e) => change(i, { minutes: Number(e.target.value) })} className="min-h-11 border border-line-strong px-2 text-[15px] font-normal">
              {[30, 45, 60, 90].map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </label>
          <button type="button" onClick={() => setSlots((x) => x.filter((_, j) => j !== i))} className="min-h-11 text-[14px] font-medium underline underline-offset-4">
            Remove<span className="sr-only"> slot {i + 1}</span>
          </button>
        </div>
      ))}
      <div className="flex flex-wrap gap-3">
        <Button type="button" variant="light" onClick={() => setSlots((x) => [...x, { dow: 1, start: '18:00', minutes: 60 }])}>
          Add slot
        </Button>
        <Button type="button" disabled={!hydrated || pending} onClick={() => start(async () => setState(await saveSlots(slots)))}>
          {pending ? 'Saving…' : 'Save slots'}
        </Button>
      </div>
      <Status state={state} />
    </div>
  );
}

export function AgreementButton() {
  const hydrated = useHydrated();
  const [state, setState] = useState<FormState>({});
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-col gap-2">
      <Button type="button" disabled={!hydrated || pending} onClick={() => start(async () => setState(await acceptAgreement()))} className="self-start">
        I accept the coach agreement
      </Button>
      <Status state={state} />
    </div>
  );
}

export function LiveForm({ live }: { live: boolean }) {
  const hydrated = useHydrated();
  const [state, action, pending] = useActionState(setLive, {});
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="live" value={live ? 'false' : 'true'} />
      <Button type="submit" variant={live ? 'light' : 'ink'} disabled={!hydrated || pending} className="self-start">
        {live ? 'Hide my profile' : 'Go live'}
      </Button>
      <Status state={state} />
    </form>
  );
}
