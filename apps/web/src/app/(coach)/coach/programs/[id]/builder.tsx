'use client';

import { Button, Input, Tag } from '@fitsphere/ui';
import { useActionState, useEffect, useRef, useState } from 'react';
import {
  defaultPrescription,
  describePrescription,
  type DraftItem,
  type DraftSession,
  maxWeekUsed,
  move,
  type Numbers,
  prescriptionError,
  type PrescriptionType,
  startingNumbers,
  toPayload,
  typeLabels,
} from '@/lib/program-draft';
import { useHydrated } from '@/lib/use-hydrated';
import { TextArea } from '../../../../welcome/fields';
import { saveProgram } from '../actions';

export type LibraryItem = { id: string; title: string; categoryId: string; categoryName: string; discipline: string };
type Program = { id: string; title: string; summary: string; weeks: number };
const SHOWN = 60;
const LEAVE = 'You have unsaved changes. Leave without saving?';
type Selected = { session: string; item: string } | null;

const numberFields: Record<PrescriptionType, { key: keyof Numbers; label: string; optional?: boolean; step?: string }[]> = {
  rounds: [
    { key: 'rounds', label: 'Rounds' },
    { key: 'work_s', label: 'Work (seconds)' },
    { key: 'rest_s', label: 'Rest (seconds)' },
  ],
  time: [{ key: 'seconds', label: 'Time (seconds)' }],
  sets: [
    { key: 'sets', label: 'Sets' },
    { key: 'reps', label: 'Reps' },
    { key: 'load_kg', label: 'Load (kg, optional)', optional: true, step: '0.5' },
  ],
};

export function Builder({ program, sessions: initial, library, saved }: { program: Program; sessions: DraftSession[]; library: LibraryItem[]; saved: boolean }) {
  const [state, action, pending] = useActionState(saveProgram, {});
  const hydrated = useHydrated();
  const counter = useRef(0);
  const newKey = () => `new-${++counter.current}`;

  const [title, setTitle] = useState(program.title);
  const [weeks, setWeeks] = useState(program.weeks);
  const [sessions, setSessionsRaw] = useState(initial);
  // Any edit makes the draft dirty; a save reloads the page from the server, which starts clean.
  const [dirty, setDirty] = useState(false);
  const setSessions: typeof setSessionsRaw = (next) => {
    setDirty(true);
    setSessionsRaw(next);
  };
  const submitting = useRef(false);

  useEffect(() => {
    if (!dirty) return;
    const onUnload = (e: BeforeUnloadEvent) => {
      if (submitting.current) return;
      e.preventDefault();
    };
    // In-app links do not fire beforeunload, so ask on any link click while there are unsaved changes.
    const onClick = (e: MouseEvent) => {
      const link = (e.target as Element | null)?.closest?.('a[href]');
      if (link && !link.getAttribute('target') && !window.confirm(LEAVE)) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener('beforeunload', onUnload);
    document.addEventListener('click', onClick, true);
    return () => {
      window.removeEventListener('beforeunload', onUnload);
      document.removeEventListener('click', onClick, true);
    };
  }, [dirty]);
  const [week, setWeek] = useState(1);
  const [target, setTarget] = useState<string | null>(initial[0]?.key ?? null);
  const [selected, setSelected] = useState<Selected>(null);
  const [query, setQuery] = useState('');
  const [sport, setSport] = useState('all');
  const search = useRef<HTMLInputElement>(null);

  // Day order, as they are saved; sessions on the same day keep the order they were added in.
  const inWeek = sessions.filter((s) => s.week === week).sort((a, b) => a.day - b.day);
  const updateSession = (key: string, change: (s: DraftSession) => DraftSession) => setSessions((all) => all.map((s) => (s.key === key ? change(s) : s)));
  const updateItem = (sessionKey: string, itemKey: string, change: (i: DraftItem) => DraftItem) =>
    updateSession(sessionKey, (s) => ({ ...s, items: s.items.map((i) => (i.key === itemKey ? change(i) : i)) }));

  const addSession = () => {
    const used = new Set(inWeek.map((s) => s.day));
    const day = [1, 2, 3, 4, 5, 6, 7].find((d) => !used.has(d)) ?? 7;
    const key = newKey();
    setSessions((all) => [...all, { key, week, day, title: '', items: [] }]);
    setTarget(key);
  };
  const removeSession = (key: string) => {
    setSessions((all) => all.filter((s) => s.key !== key));
    if (target === key) setTarget(null);
    if (selected?.session === key) setSelected(null);
  };
  const addItem = (c: LibraryItem) => {
    if (!target) return;
    const key = newKey();
    updateSession(target, (s) => ({ ...s, items: [...s.items, { key, item: c.id, title: c.title, cue: '', ...defaultPrescription(c.categoryId) }] }));
    setSelected({ session: target, item: key });
  };

  const targetSession = sessions.find((s) => s.key === target && s.week === week);
  const chosen = selected ? sessions.find((s) => s.key === selected.session)?.items.find((i) => i.key === selected.item) : undefined;
  const errors = sessions.flatMap((s) => s.items.map((i) => prescriptionError(i))).filter(Boolean);
  const unavailable = sessions.some((s) => s.items.some((i) => i.unavailable));
  const sports = [...new Map(library.map((c) => [c.categoryId, c.categoryName]))];
  const q = query.trim().toLowerCase();
  const found = library.filter((c) => (sport === 'all' || c.categoryId === sport) && (!q || c.title.toLowerCase().includes(q) || c.discipline.toLowerCase().includes(q)));
  const sessionName = (s: DraftSession) => `Day ${s.day}${s.title.trim() ? ` · ${s.title.trim()}` : ''}`;

  return (
    <form
      action={action}
      onSubmit={() => {
        submitting.current = true;
      }}
      noValidate
      className="grid gap-10 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]"
    >
      <input type="hidden" name="id" value={program.id} />
      <input type="hidden" name="sessions" value={JSON.stringify(toPayload(sessions))} />

      <div className="flex flex-col gap-6">
        {saved && !dirty ? (
          <span role="status" className="self-start">
            <Tag variant="success">Draft saved</Tag>
          </span>
        ) : dirty ? (
          <span className="self-start text-[14px] font-medium text-muted">Unsaved changes</span>
        ) : null}
        <Input
          label="Program name"
          name="title"
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            setDirty(true);
          }}
          maxLength={120}
          error={state.field === 'title' ? state.error : undefined}
        />
        <TextArea label="Summary" name="summary" defaultValue={program.summary} rows={2} maxLength={500} onChange={() => setDirty(true)} />
        <label className="flex flex-col gap-2 text-[15px] font-medium">
          Length
          <select
            name="weeks"
            value={weeks}
            onChange={(e) => {
              const n = Number(e.target.value);
              setWeeks(n);
              setDirty(true);
              if (week > n) setWeek(n);
            }}
            className="min-h-12 max-w-[200px] border border-line-strong bg-paper px-3 text-[16px] font-normal"
          >
            {Array.from({ length: 26 }, (_, i) => i + 1)
              .filter((n) => n >= maxWeekUsed(sessions))
              .map((n) => (
                <option key={n} value={n}>
                  {n} {n === 1 ? 'week' : 'weeks'}
                </option>
              ))}
          </select>
          <span className="text-[14px] font-normal text-muted">To make it shorter, first remove the sessions in the last weeks.</span>
        </label>

        <nav aria-label="Weeks" className="flex flex-wrap gap-2">
          {Array.from({ length: weeks }, (_, i) => i + 1).map((n) => (
            <button
              key={n}
              type="button"
              aria-pressed={week === n}
              onClick={() => setWeek(n)}
              className={`inline-flex min-h-11 items-center rounded-pill px-5 text-[15px] font-medium ${week === n ? 'bg-ink text-paper' : 'border border-line-strong'}`}
            >
              Week {n}
            </button>
          ))}
        </nav>

        {!inWeek.length ? <p className="m-0 bg-mist p-6 text-[16px] text-muted">No sessions in week {week} yet.</p> : null}
        {inWeek.map((s, n) => (
          <section key={s.key} aria-label={`Session ${n + 1}`} className={`flex flex-col gap-4 border p-4 ${target === s.key ? 'border-ink' : 'border-line'}`}>
            <div className="grid gap-3 sm:grid-cols-[160px_minmax(0,1fr)]">
              <label className="flex flex-col gap-2 text-[15px] font-medium">
                Day of the week
                <select
                  aria-label={`Day for session ${n + 1}`}
                  value={s.day}
                  onChange={(e) => updateSession(s.key, (x) => ({ ...x, day: Number(e.target.value) }))}
                  className="min-h-12 border border-line-strong bg-paper px-3 text-[16px] font-normal"
                >
                  {[1, 2, 3, 4, 5, 6, 7].map((d) => (
                    <option key={d} value={d}>
                      Day {d}
                    </option>
                  ))}
                </select>
              </label>
              <Input
                label="Session title"
                aria-label={`Title for session ${n + 1}`}
                value={s.title}
                maxLength={80}
                placeholder="Jab and footwork"
                onChange={(e) => updateSession(s.key, (x) => ({ ...x, title: e.target.value }))}
              />
            </div>

            {s.items.length ? (
              <ol aria-label={`Drills in ${sessionName(s)}`} className="m-0 flex list-none flex-col p-0">
                {s.items.map((it, i) => {
                  const error = it.unavailable ? 'No longer published in the library. Remove it to save.' : prescriptionError(it);
                  return (
                    <li key={it.key} className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-line py-2">
                      <div className="flex min-w-0 flex-1 flex-col">
                        <span className="text-[16px] font-medium">{it.title}</span>
                        <span className={`text-[14px] ${error ? 'font-medium text-danger' : 'text-muted'}`}>{error ?? describePrescription(it.type, it)}</span>
                      </div>
                      <button type="button" onClick={() => setSelected({ session: s.key, item: it.key })} className="min-h-11 px-2 text-[14px] font-medium underline">
                        Edit<span className="sr-only"> {it.title}</span>
                      </button>
                      <button
                        type="button"
                        disabled={i === 0}
                        onClick={() => updateSession(s.key, (x) => ({ ...x, items: move(x.items, i, -1) }))}
                        className="min-h-11 px-2 text-[14px] underline disabled:no-underline disabled:opacity-40"
                      >
                        Up<span className="sr-only">: move {it.title} up</span>
                      </button>
                      <button
                        type="button"
                        disabled={i === s.items.length - 1}
                        onClick={() => updateSession(s.key, (x) => ({ ...x, items: move(x.items, i, 1) }))}
                        className="min-h-11 px-2 text-[14px] underline disabled:no-underline disabled:opacity-40"
                      >
                        Down<span className="sr-only">: move {it.title} down</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          updateSession(s.key, (x) => ({ ...x, items: x.items.filter((y) => y.key !== it.key) }));
                          if (selected?.item === it.key) setSelected(null);
                        }}
                        className="min-h-11 px-2 text-[14px] underline"
                      >
                        Remove<span className="sr-only"> {it.title}</span>
                      </button>
                    </li>
                  );
                })}
              </ol>
            ) : (
              <p className="m-0 text-[15px] text-muted">No drills yet. Add them from the library.</p>
            )}

            <div className="flex flex-wrap gap-4">
              <button
                type="button"
                onClick={() => {
                  setTarget(s.key);
                  search.current?.focus();
                }}
                className="min-h-11 text-[15px] font-medium underline underline-offset-4"
              >
                Add from library<span className="sr-only"> to session {n + 1}</span>
              </button>
              <button type="button" onClick={() => removeSession(s.key)} className="min-h-11 text-[15px] text-danger underline underline-offset-4">
                Remove session<span className="sr-only"> {n + 1}</span>
              </button>
            </div>
          </section>
        ))}
        <button type="button" onClick={addSession} className="min-h-11 self-start text-[15px] font-medium underline underline-offset-4">
          Add session to week {week}
        </button>
      </div>

      <aside className="flex flex-col gap-6 self-start md:sticky md:top-6">
        {chosen && selected ? (
          <section aria-labelledby="selected" className="flex flex-col gap-4 border border-line-strong p-5">
            <h2 id="selected" className="m-0 text-[20px] font-medium">
              {chosen.title}
            </h2>
            <label className="flex flex-col gap-2 text-[15px] font-medium">
              Prescription
              <select
                value={chosen.type}
                onChange={(e) => {
                  const type = e.target.value as PrescriptionType;
                  updateItem(selected.session, selected.item, (i) => ({ ...i, type, ...startingNumbers(type) }));
                }}
                className="min-h-12 border border-line-strong bg-paper px-3 text-[16px] font-normal"
              >
                {(Object.keys(typeLabels) as PrescriptionType[]).map((t) => (
                  <option key={t} value={t}>
                    {typeLabels[t]}
                  </option>
                ))}
              </select>
            </label>
            <div className="grid grid-cols-2 gap-3">
              {numberFields[chosen.type].map((f) => (
                <Input
                  key={f.key}
                  label={f.label}
                  type="number"
                  inputMode={f.step ? 'decimal' : 'numeric'}
                  step={f.step ?? '1'}
                  value={chosen[f.key] == null || Number.isNaN(chosen[f.key]) ? '' : String(chosen[f.key])}
                  onChange={(e) => {
                    const raw = e.target.value;
                    const v = raw === '' ? (f.optional ? null : Number.NaN) : Number(raw);
                    updateItem(selected.session, selected.item, (i) => ({ ...i, [f.key]: v }));
                  }}
                />
              ))}
            </div>
            {prescriptionError(chosen) ? (
              <p role="alert" className="m-0 text-[14px] font-medium text-danger">
                {prescriptionError(chosen)}
              </p>
            ) : null}
            <TextArea
              label="Coach cue for athletes"
              value={chosen.cue}
              rows={2}
              maxLength={200}
              onChange={(e) => updateItem(selected.session, selected.item, (i) => ({ ...i, cue: e.target.value }))}
            />
            <button type="button" onClick={() => setSelected(null)} className="min-h-11 self-start text-[14px] underline">
              Done
            </button>
          </section>
        ) : null}

        <section aria-labelledby="library" className="flex flex-col gap-3 border border-line p-5">
          <h2 id="library" className="m-0 text-[20px] font-medium">
            Drill library
          </h2>
          <p className="m-0 text-[14px] text-muted">{targetSession ? `Adding to ${sessionName(targetSession)}` : 'Add a session to this week, then add drills to it.'}</p>
          <Input ref={search} label="Search drills" type="search" value={query} onChange={(e) => setQuery(e.target.value)} />
          <div role="group" aria-label="Sport" className="flex flex-wrap gap-2">
            {[['all', 'All'], ...sports].map(([id, name]) => (
              <button
                key={id}
                type="button"
                aria-pressed={sport === id}
                onClick={() => setSport(id)}
                className={`inline-flex min-h-11 items-center rounded-pill px-4 text-[14px] font-medium ${sport === id ? 'bg-ink text-paper' : 'border border-line-strong'}`}
              >
                {name}
              </button>
            ))}
          </div>
          <ul aria-label="Library results" className="m-0 flex max-h-[420px] list-none flex-col overflow-y-auto p-0">
            {found.slice(0, SHOWN).map((c) => (
              <li key={c.id} className="flex items-center gap-2 border-b border-line py-2">
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="text-[15px] font-medium">{c.title}</span>
                  <span className="text-[13px] text-muted">
                    {c.categoryName} · {c.discipline}
                  </span>
                </div>
                <button type="button" disabled={!targetSession} onClick={() => addItem(c)} className="min-h-11 px-3 text-[14px] font-medium underline disabled:no-underline disabled:opacity-40">
                  Add<span className="sr-only"> {c.title}</span>
                </button>
              </li>
            ))}
            {!found.length ? <li className="py-2 text-[15px] text-muted">No published drills match.</li> : null}
          </ul>
          {found.length > SHOWN ? (
            <p className="m-0 text-[13px] font-medium">
              Showing {SHOWN} of {found.length}. Search or pick a sport to find the rest.
            </p>
          ) : null}
          <p className="m-0 text-[13px] text-muted">Only published, coach-verified drills appear here.</p>
        </section>

        <div className="flex flex-col gap-3">
          {unavailable ? (
            <p className="m-0 text-[14px] font-medium text-danger">Remove the drills marked as no longer published before you save.</p>
          ) : errors.length ? (
            <p className="m-0 text-[14px] font-medium text-danger">Fix the numbers marked in red before you save.</p>
          ) : state.error && state.field !== 'title' ? (
            <p role="alert" className="m-0 text-[14px] font-medium text-danger">
              {state.error}
            </p>
          ) : null}
          <Button type="submit" name="intent" value="publish" disabled={!hydrated || pending || errors.length > 0 || unavailable || !sessions.length}>
            Publish changes
          </Button>
          <Button type="submit" name="intent" value="save" variant="light" disabled={!hydrated || pending || errors.length > 0 || unavailable}>
            Save draft
          </Button>
          <p className="m-0 text-[14px] text-muted">Athletes already in the program see published changes from tomorrow.</p>
        </div>
      </aside>
    </form>
  );
}
