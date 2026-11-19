'use client';

import { addTime, clock, nextTarget, skip, startTimer, type TimerState } from '@fitsphere/core';
import { Button } from '@fitsphere/ui';
import { useEffect, useRef, useState, useTransition } from 'react';
import type { PlayerDrill } from './player';
import type { LastTime } from '@/lib/session-player';
import { parseLoad } from '@/lib/session-player';
import { useHydrated } from '@/lib/use-hydrated';
import { logSet } from './actions';
import { useTicking, useWakeLock } from './timer-hooks';

export type SetRow = { setNo: number; reps: number; loadKg: number | null; rpe: number };

// The prescription has no rest for sets; 90 s suits most lifting, and "Add 30 s" stretches it.
const REST_S = 90;
const kg = (n: number | null) => (n === null ? 'bodyweight' : `${n} kg`);
const short = (s: { reps: number; loadKg: number | null }) => (s.loadKg === null ? `${s.reps} reps` : `${s.reps} × ${s.loadKg}`);
const shortDate = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' });

/** "3 × 8 at 50 kg" when every set matched, else each set listed. */
function describeSets(sets: { reps: number; loadKg: number | null }[]) {
  const first = sets[0]!;
  if (sets.every((s) => s.reps === first.reps && s.loadKg === first.loadKg)) return `${sets.length} × ${first.reps}${first.loadKg === null ? '' : ` at ${first.loadKg} kg`}`;
  return sets.map(short).join(', ');
}

function Rpe({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <fieldset className="m-0 border-0 p-0">
      <legend className="pb-2.5 text-[14px] font-medium">How hard was it? (RPE 1–10)</legend>
      <div className="grid max-w-[400px] grid-cols-10 gap-1">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
          <label
            key={n}
            className={`relative flex h-11 min-w-0 cursor-pointer items-center justify-center text-[15px] ${value === n ? 'bg-ink font-semibold text-paper' : 'border border-line-strong bg-paper text-ink'} has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ink`}
          >
            <input type="radio" name="rpe" value={n} checked={value === n} onChange={() => onChange(n)} className="sr-only" aria-label={`Effort ${n} of 10`} />
            <span aria-hidden="true">{n}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function SetLogger({
  drill,
  initial,
  last,
  coach,
  session,
  date,
  nextLabel,
  onChange,
  onNext,
  finishing,
}: {
  drill: PlayerDrill;
  initial: SetRow[];
  last: LastTime | null;
  coach: string;
  session: string;
  date: string;
  nextLabel: (allDone: boolean) => string;
  onChange: (rows: SetRow[]) => void;
  onNext: () => void;
  /** True while the player finishes the session, so the last button cannot be tapped twice. */
  finishing: boolean;
}) {
  const hydrated = useHydrated();
  const planned = Number(drill.prescription.sets);
  const topReps = Number(drill.prescription.reps);
  const coachLoad = drill.prescription.load_kg ?? null;
  const target = last ? nextTarget(topReps, planned, last.sets) : null;

  const [rows, setRows] = useState(() => [...initial].sort((a, b) => a.setNo - b.setNo));
  const openSet = (list: SetRow[]) => {
    for (let n = 1; n <= planned; n++) if (!list.some((r) => r.setNo === n)) return n;
    return null;
  };
  const [current, setCurrent] = useState<number | null>(() => openSet(initial));
  const count = Math.min(20, Math.max(planned, ...rows.map((r) => r.setNo), current ?? 0));

  // The editor's starting values: the set's own log, else the last set logged today, else the target or the plan.
  const startValues = (n: number | null, list: SetRow[]) => {
    const own = list.find((r) => r.setNo === n);
    const prev = [...list].reverse().find((r) => r.setNo !== n);
    const load = own ? own.loadKg : prev ? prev.loadKg : (target?.loadKg ?? coachLoad);
    return { reps: String(own?.reps ?? topReps), load: load === null ? '' : String(load), rpe: own?.rpe ?? prev?.rpe ?? 0 };
  };
  const [reps, setReps] = useState(() => startValues(current, initial).reps);
  const [load, setLoad] = useState(() => startValues(current, initial).load);
  const [rpe, setRpe] = useState(() => startValues(current, initial).rpe);
  const [error, setError] = useState('');
  const [pending, start] = useTransition();
  const [rest, setRest] = useState<TimerState | null>(null);
  const change = useTicking(rest, setRest);
  useWakeLock(!!rest?.running);
  const repsInput = useRef<HTMLInputElement>(null);

  // The end of a rest: a buzz where phones allow it, and words for screen readers.
  const restDone = rest?.phase === 'done';
  useEffect(() => {
    if (!restDone) return;
    navigator.vibrate?.([200, 100, 200]);
  }, [restDone]);
  const announce = restDone && openSet(rows) ? `Rest over. Set ${openSet(rows)}.` : '';

  const edit = (n: number | null) => {
    setCurrent(n);
    const v = startValues(n, rows);
    setReps(v.reps);
    setLoad(v.load);
    setRpe(v.rpe);
    setError('');
    if (n) setTimeout(() => repsInput.current?.focus(), 0);
  };

  const save = () => {
    if (!current) return;
    const r = Number(reps);
    const l = parseLoad(load);
    if (!/^\d{1,3}$/.test(reps.trim()) || r > 200) return setError('Enter the reps you did, from 0 to 200.');
    if (l === undefined) return setError('Enter the load in kg, up to 500 with at most two decimals, or leave it blank for bodyweight.');
    if (!rpe) return setError('Pick how hard the set was.');
    setError('');
    const row: SetRow = { setNo: current, reps: r, loadKg: l, rpe };
    // A rest follows the set in progress; correcting an earlier set leaves any rest as it is.
    const wasOpen = current === openSet(rows);
    start(async () => {
      const result = await logSet({ session, date, position: drill.position, ...row });
      if ('error' in result) {
        setError(result.error);
        return;
      }
      const next = [...rows.filter((x) => x.setNo !== row.setNo), row].sort((a, b) => a.setNo - b.setNo);
      setRows(next);
      onChange(next);
      const open = openSet(next);
      setCurrent(open);
      if (open) {
        const v = startValues(open, next);
        setReps(v.reps);
        setRpe(row.rpe);
        setLoad(wasOpen ? load : v.load);
        if (wasOpen) setRest(startTimer({ rounds: 1, workS: REST_S, restS: 0 }));
      } else setRest(null);
    });
  };

  const nextOpen = openSet(rows);
  const allDone = nextOpen === null;
  const editing = current !== null && rows.some((r) => r.setNo === current);

  return (
    <section aria-labelledby="sets-title" className="flex min-w-0 flex-[2_1_420px] flex-col gap-5 bg-paper p-5 text-ink md:p-8">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="sets-title" className="m-0 font-display text-[32px] font-normal uppercase leading-none md:text-[40px]">
          Your sets
        </h2>
        <span className="text-[14px] text-muted">
          {planned} × {topReps}
          {coachLoad !== null ? ` · plan ${coachLoad} kg` : ''} · rest {REST_S} s
        </span>
      </div>
      <p className="m-0 text-[15px] leading-normal text-ink-soft">
        {!last ? (
          'First time logging this exercise.'
        ) : (
          <>
            Last time ({shortDate.format(new Date(`${last.date}T00:00:00Z`))}) you did <strong>{describeSets(last.sets)}</strong>.{' '}
            {target?.change === 'increase' ? (
              <>
                Every set hit {topReps}, so today try <strong>{target.loadKg} kg</strong>.
              </>
            ) : target ? (
              <>
                Not every set hit {topReps}, so stay at <strong>{target.loadKg} kg</strong>.
              </>
            ) : null}
          </>
        )}
      </p>

      <table className="w-full border-collapse text-left text-[15px]">
        <thead>
          <tr className="border-b border-line text-[13px] text-muted">
            <th scope="col" className="py-2 pr-2 font-medium">
              Set
            </th>
            <th scope="col" className="py-2 pr-2 font-medium">
              Last time
            </th>
            <th scope="col" className="py-2 pr-2 font-medium">
              Today
            </th>
            <th scope="col" className="py-2 font-medium">
              <span className="sr-only">Action</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: count }, (_, i) => i + 1).map((n) => {
            const row = rows.find((r) => r.setNo === n);
            const prev = last?.sets[n - 1];
            return (
              <tr key={n} aria-current={n === current ? 'step' : undefined} className={`border-b border-line ${n === current ? 'bg-mist' : ''}`}>
                <td className="py-2.5 pr-2 font-medium">{n}</td>
                <td className="py-2.5 pr-2 text-muted">{prev ? short(prev) : '–'}</td>
                <td className="py-2.5 pr-2">{row ? `${row.reps} × ${kg(row.loadKg)} · RPE ${row.rpe}` : n === current ? 'Now' : 'Next'}</td>
                <td className="py-1 text-right">
                  {row && n !== current ? (
                    <button type="button" onClick={() => edit(n)} className="min-h-11 text-[14px] font-medium underline underline-offset-4">
                      Edit<span className="sr-only"> set {n}</span>
                    </button>
                  ) : null}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {rest && nextOpen ? (
        <div className="flex flex-wrap items-center justify-between gap-4 bg-ink p-4 text-paper">
          <div>
            <p className="m-0 text-[14px] text-line-strong">{rest.phase === 'done' ? 'Rest over' : `Rest before set ${nextOpen}`}</p>
            <p role="timer" aria-label="Rest left" className="m-0 font-display text-[48px] leading-none tabular-nums">
              {clock(rest.remainingMs)}
            </p>
          </div>
          {rest.phase !== 'done' ? (
            <div className="flex gap-2">
              <Button variant="ghost" size="small" onClick={() => change((t) => addTime(t, 30_000))}>
                Add 30 s
              </Button>
              <Button variant="ghost" size="small" onClick={() => change(skip)}>
                Skip rest
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}
      <p aria-live="assertive" className="sr-only">
        {announce}
      </p>

      {current ? (
        <form
          aria-label={`Set ${current}`}
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          <h3 className="m-0 text-[16px] font-semibold">Set {current}</h3>
          <div className="flex flex-wrap gap-4">
            <label className="flex w-28 flex-col gap-1.5 text-[14px] font-medium">
              Reps
              <input ref={repsInput} inputMode="numeric" value={reps} onChange={(e) => setReps(e.target.value)} className="min-h-12 border border-line-strong px-3 text-[18px] font-normal" />
            </label>
            <label className="flex w-36 flex-col gap-1.5 text-[14px] font-medium">
              Load (kg)
              <input inputMode="decimal" value={load} placeholder="Bodyweight" onChange={(e) => setLoad(e.target.value)} className="min-h-12 border border-line-strong px-3 text-[18px] font-normal" />
            </label>
          </div>
          <Rpe value={rpe} onChange={setRpe} />
          {error ? (
            <p role="alert" className="m-0 text-[14px] font-medium text-danger">
              {error}
            </p>
          ) : null}
          <div className="flex flex-wrap items-center gap-4">
            <Button type="submit" disabled={!hydrated || pending}>
              {pending ? 'Saving…' : editing ? `Save set ${current}` : `Log set ${current}`}
            </Button>
            {editing ? (
              <button type="button" onClick={() => edit(nextOpen)} className="min-h-11 text-[15px] font-medium underline underline-offset-4">
                Cancel
              </button>
            ) : null}
          </div>
        </form>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <p className="m-0 text-[15px] font-medium text-success">All {planned} sets logged.</p>
          {count < 20 ? (
            <button type="button" onClick={() => edit(count + 1)} className="min-h-11 text-[15px] font-medium underline underline-offset-4">
              Add a set
            </button>
          ) : null}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
        <p className="m-0 text-[14px] text-muted">Self-reported · {coach} sees this log</p>
        <Button variant={allDone ? 'ink' : 'light'} onClick={onNext} disabled={!hydrated || pending || finishing}>
          {finishing ? 'Finishing…' : nextLabel(allDone)}
        </Button>
      </div>
    </section>
  );
}
