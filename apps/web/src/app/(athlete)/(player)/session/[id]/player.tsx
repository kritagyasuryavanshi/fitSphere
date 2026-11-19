'use client';

import { clock, pause, resume, roundsCompleted, skip, startTimer, tick, type TimerState } from '@fitsphere/core';
import { Button, buttonClass } from '@fitsphere/ui';
import Link from 'next/link';
import { useEffect, useRef, useState, useTransition } from 'react';
import { Icon } from '@/components/layout/icons';
import { describePrescription, type Numbers, type PrescriptionType } from '@/lib/program-draft';
import { firstOpen, timerPlan } from '@/lib/session-player';
import { useHydrated } from '@/lib/use-hydrated';
import { finishSession, logDrill } from './actions';

export type PlayerDrill = { position: number; type: PrescriptionType; prescription: Numbers; cue: string; title: string; href: string | null };
type Logged = { position: number; rounds: number | null; technique: number; effort: number; note: string };

type Props = {
  session: string;
  date: string;
  isToday: boolean;
  title: string;
  line: string;
  coach: string;
  drills: PlayerDrill[];
  logged: Logged[];
  completed: boolean;
};

const dayName = new Intl.DateTimeFormat('en-IN', { weekday: 'long', day: 'numeric', month: 'short', timeZone: 'UTC' });

/** Keeps the screen on while active, where the browser supports it. The lock drops when the tab hides, so it is taken again on return. */
function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active || typeof navigator === 'undefined' || !('wakeLock' in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    let stopped = false;
    const take = () =>
      navigator.wakeLock
        .request('screen')
        .then((l) => {
          if (stopped) void l.release();
          else lock = l;
        })
        .catch(() => {});
    void take();
    const onShow = () => {
      if (document.visibilityState === 'visible' && (!lock || lock.released)) void take();
    };
    document.addEventListener('visibilitychange', onShow);
    return () => {
      stopped = true;
      document.removeEventListener('visibilitychange', onShow);
      void lock?.release().catch(() => {});
    };
  }, [active]);
}

/** Ticks a running timer with the real time passed, so a slept phone catches up. */
function useTicking(timer: TimerState | null, setTimer: (f: (t: TimerState | null) => TimerState | null) => void) {
  const running = !!timer?.running;
  useEffect(() => {
    if (!running) return;
    let last = performance.now();
    const id = setInterval(() => {
      const now = performance.now();
      const passed = now - last;
      last = now;
      setTimer((t) => (t ? tick(t, passed) : t));
    }, 200);
    return () => clearInterval(id);
  }, [running, setTimer]);
}

function phaseLabel(drill: PlayerDrill, t: TimerState | null) {
  if (drill.type === 'time') return t?.phase === 'done' ? 'Time' : t ? 'Work' : 'Ready';
  const round = `Round ${t?.round ?? 1} of ${drill.prescription.rounds}`;
  if (!t) return `${round} · Ready`;
  return t.phase === 'done' ? `All ${t.rounds} rounds done` : `${round} · ${t.phase === 'work' ? 'Work' : 'Rest'}`;
}

function Choice({ name, value, checked, onChange, label, wide }: { name: string; value: number; checked: boolean; onChange: () => void; label: string; wide?: boolean }) {
  return (
    <label className={`relative flex h-11 cursor-pointer items-center justify-center text-[15px] ${wide ? 'w-full min-w-0' : 'w-11 rounded-full'} ${checked ? 'bg-ink font-semibold text-paper' : 'border border-line-strong bg-paper text-ink'} has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ink`}>
      <input type="radio" name={name} value={value} checked={checked} onChange={onChange} className="sr-only" aria-label={label} />
      <span aria-hidden="true">{value}</span>
    </label>
  );
}

function LogForm({ drill, existing, autoRounds, coach, last, onSaved, session, date }: {
  drill: PlayerDrill;
  existing: Logged | undefined;
  autoRounds: number;
  coach: string;
  last: boolean;
  onSaved: (l: Logged, finish: boolean) => void;
  session: string;
  date: string;
}) {
  const hydrated = useHydrated();
  const [pending, start] = useTransition();
  const [rounds, setRounds] = useState<number | null>(existing?.rounds ?? null);
  const [technique, setTechnique] = useState(existing?.technique ?? 0);
  const [effort, setEffort] = useState(existing?.effort ?? 0);
  const [note, setNote] = useState(existing?.note ?? '');
  const [error, setError] = useState('');
  const planned = drill.type === 'rounds' ? Number(drill.prescription.rounds) : 0;
  const shown = rounds ?? autoRounds;

  const save = () => {
    if (!technique || !effort) {
      setError('Pick a technique feel and an effort.');
      return;
    }
    setError('');
    const entry: Logged = { position: drill.position, rounds: drill.type === 'rounds' ? shown : null, technique, effort, note: note.trim() };
    start(async () => {
      const result = await logDrill({ session, date, ...entry });
      if ('error' in result) setError(result.error);
      else onSaved(entry, last);
    });
  };

  return (
    <section id="log" aria-labelledby="log-title" className="flex flex-wrap items-start gap-8 bg-paper p-5 text-ink md:p-8">
      <div className="flex-[1_1_200px]">
        <h2 id="log-title" className="m-0 font-display text-[40px] font-normal uppercase leading-[0.95]">
          Log it
        </h2>
        <p className="m-0 mt-2 text-[14px] text-muted">Self-reported · {coach} sees this</p>
      </div>
      {drill.type === 'rounds' ? (
        <fieldset className="m-0 flex-[1_1_180px] border-0 p-0">
          <legend className="pb-2.5 text-[14px] font-medium">Rounds done</legend>
          <div className="flex items-center gap-3">
            <button type="button" aria-label="Fewer rounds" disabled={shown <= 0} onClick={() => setRounds(Math.max(0, shown - 1))} className="size-11 rounded-full border border-line-strong bg-paper text-[20px] disabled:opacity-40">
              −
            </button>
            <output aria-live="polite" className="min-w-8 text-center font-display text-[40px] leading-none">
              {shown}
            </output>
            <button type="button" aria-label="More rounds" disabled={shown >= planned} onClick={() => setRounds(Math.min(planned, shown + 1))} className="size-11 rounded-full border border-line-strong bg-paper text-[20px] disabled:opacity-40">
              +
            </button>
            <span className="text-[14px] text-muted">of {planned}</span>
          </div>
        </fieldset>
      ) : null}
      <fieldset className="m-0 flex-[1_1_240px] border-0 p-0">
        <legend className="pb-2.5 text-[14px] font-medium">Technique feel (1–5)</legend>
        <div className="flex gap-1.5">
          {[1, 2, 3, 4, 5].map((n) => (
            <Choice key={n} name="technique" value={n} checked={technique === n} onChange={() => setTechnique(n)} label={`Technique ${n} of 5`} />
          ))}
        </div>
      </fieldset>
      <fieldset className="m-0 flex-[1_1_380px] border-0 p-0">
        <legend className="pb-2.5 text-[14px] font-medium">Effort (RPE 1–10)</legend>
        {/* Ten in one row: about 32 px each on a phone. */}
        <div className="grid max-w-[400px] grid-cols-10 gap-1">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
            <Choice key={n} name="effort" value={n} checked={effort === n} onChange={() => setEffort(n)} label={`Effort ${n} of 10`} wide />
          ))}
        </div>
      </fieldset>
      <label className="flex flex-[2_1_320px] flex-col gap-2.5 text-[14px] font-medium">
        Note for your coach
        <textarea rows={2} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} className="resize-y border border-line-strong p-3 text-[15px] font-normal" />
      </label>
      <div className="flex flex-[1_1_200px] flex-col gap-2 self-end">
        {error ? (
          <p role="alert" className="m-0 text-[14px] font-medium text-danger">
            {error}
          </p>
        ) : null}
        <Button type="button" onClick={save} disabled={!hydrated || pending}>
          {pending ? 'Saving…' : last ? 'Save and finish' : 'Save and next drill'}
        </Button>
      </div>
    </section>
  );
}

export function Player({ session, date, isToday, title, line, coach, drills, logged, completed }: Props) {
  const [logs, setLogs] = useState(() => new Map(logged.map((l) => [l.position, l])));
  const [index, setIndex] = useState(() =>
    firstOpen(
      drills.map((d) => d.position),
      logged.map((l) => l.position),
    ),
  );
  const [timer, setTimer] = useState<TimerState | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [finishError, setFinishError] = useState('');
  const [finishing, startFinish] = useTransition();
  const [announce, setAnnounce] = useState('');
  const hydrated = useHydrated();
  const drill = drills[index];
  const last = index === drills.length - 1;

  useTicking(timer, setTimer);
  useWakeLock(!!timer?.running);

  // Session time since the player opened.
  useEffect(() => {
    const started = Date.now();
    const id = setInterval(() => setElapsed(Date.now() - started), 1000);
    return () => clearInterval(id);
  }, []);

  // Phase changes: a buzz where phones allow it, and words for screen readers.
  const phaseKey = timer ? `${timer.phase}-${timer.round}` : '';
  const firstPhase = useRef(true);
  useEffect(() => {
    if (!phaseKey || !drill) return;
    if (firstPhase.current) {
      firstPhase.current = false;
      return;
    }
    navigator.vibrate?.(timer?.phase === 'done' ? [200, 100, 200] : 300);
    setAnnounce(phaseLabel(drill, timer));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs on the phase change only.
  }, [phaseKey]);

  const goTo = (i: number) => {
    setTimer(null);
    firstPhase.current = true;
    setIndex(i);
    window.scrollTo({ top: 0 });
  };

  const onSaved = (entry: Logged, finish: boolean) => {
    setLogs((m) => new Map(m).set(entry.position, entry));
    if (finish) {
      startFinish(async () => {
        const result = await finishSession(session, date);
        if (result && 'error' in result) {
          setFinishError(result.error);
          goTo(drills.length);
        }
      });
    } else goTo(index + 1);
  };

  const finish = () =>
    startFinish(async () => {
      const result = await finishSession(session, date);
      if (result && 'error' in result) setFinishError(result.error);
    });

  const plan = drill ? timerPlan(drill.type, drill.prescription) : null;
  const progress = Math.round((logs.size / drills.length) * 100);
  const lineWithDate = isToday ? line : `${line} · for ${dayName.format(new Date(`${date}T00:00:00Z`))}`;

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="border-b border-[#2b2b2d]">
        <div className="mx-auto flex min-h-16 max-w-[1440px] items-center justify-between gap-3 px-3 md:gap-5 md:px-10">
          <Link href="/today" className="flex min-h-11 items-center gap-2 text-[15px] font-medium text-paper hover:text-line-strong" aria-label="End session">
            <Icon name="close" size={18} />
            <span className="hidden md:inline" aria-hidden="true">
              End session
            </span>
          </Link>
          <div className="min-w-0 text-center">
            <p className="m-0 truncate text-[14px] font-semibold md:text-[15px]">{title}</p>
            <p className="m-0 mt-0.5 truncate text-[12px] text-faint md:text-[13px]">{lineWithDate}</p>
          </div>
          <span className="text-right text-[12px] font-medium md:text-[15px]">
            {drill ? `Drill ${index + 1} of ${drills.length}` : 'Finish'}
            {hydrated ? <span className="hidden md:inline"> · {clock(elapsed)} elapsed</span> : null}
          </span>
        </div>
        <div role="progressbar" aria-label="Drills logged" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} className="h-1 bg-[#2b2b2d]">
          <div className="h-full bg-volt" style={{ width: `${progress}%` }} />
        </div>
      </header>

      <p aria-live="assertive" className="sr-only">
        {announce}
      </p>

      <main className="mx-auto flex w-full max-w-[1440px] flex-col gap-8 px-4 pb-16 pt-5 md:px-10 md:pt-8">
        {drill && plan ? (
          <>
            <div className="flex flex-wrap items-stretch gap-6 md:gap-8">
              <section aria-label="Drill" className="flex min-h-[200px] min-w-0 flex-[3_1_560px] flex-col justify-end gap-4 bg-[#1b1b1b] p-5 md:min-h-[420px] md:p-8">
                <p className="m-0 text-[14px] font-medium text-line">Now</p>
                <h1 className="m-0 break-words font-display text-[52px] font-normal uppercase leading-[0.9] md:text-[clamp(56px,6vw,96px)]">{drill.title}</h1>
                <p className="m-0 text-[15px] text-faint">{describePrescription(drill.type, drill.prescription)}</p>
                {drill.href ? (
                  <a href={drill.href} target="_blank" rel="noopener" className={`${buttonClass({ variant: 'light', size: 'small' })} self-start`}>
                    Watch demo<span className="sr-only"> (opens in a new tab)</span>
                  </a>
                ) : null}
              </section>

              <section aria-label="Round timer" className="flex min-w-0 flex-[2_1_380px] flex-col gap-6">
                <div className="flex flex-col items-center gap-2 bg-[#1b1b1b] p-6 text-center md:items-start md:p-8 md:text-left">
                  <p className="m-0 text-[15px] font-medium text-volt">{phaseLabel(drill, timer)}</p>
                  <p role="timer" aria-label="Time left" className="m-0 font-display text-[128px] leading-[0.9] tabular-nums md:text-[clamp(120px,12vw,180px)]">
                    {clock(timer ? timer.remainingMs : plan.workS * 1000)}
                  </p>
                  <p className="m-0 text-[15px] text-faint">
                    {drill.type === 'rounds' ? `${clock(plan.workS * 1000)} work · ${clock(plan.restS * 1000)} rest` : `${clock(plan.workS * 1000)} block`}
                  </p>
                  <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
                    {!timer || timer.phase !== 'done' ? (
                      <button
                        type="button"
                        aria-label={!timer ? 'Start timer' : timer.running ? 'Pause' : 'Resume'}
                        disabled={!hydrated}
                        onClick={() => setTimer((t) => (!t ? startTimer(plan) : t.running ? pause(t) : resume(t)))}
                        className="flex size-[72px] items-center justify-center rounded-full bg-volt text-ink focus-visible:outline-paper md:size-16"
                      >
                        {timer?.running ? (
                          <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                            <rect x="6" y="5" width="4" height="14" />
                            <rect x="14" y="5" width="4" height="14" />
                          </svg>
                        ) : (
                          <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                            <path d="M8 5v14l11-7z" />
                          </svg>
                        )}
                      </button>
                    ) : null}
                    {timer && timer.phase !== 'done' ? (
                      <Button variant="ghost" size="small" onClick={() => setTimer((t) => (t ? skip(t) : t))}>
                        {timer.phase === 'rest' ? 'Skip rest' : drill.type === 'rounds' ? 'End round' : 'End early'}
                      </Button>
                    ) : null}
                    <Button variant="ghost" size="small" className="border-[#4b4b4d] text-line-strong" onClick={() => goTo(index + 1)}>
                      {last ? 'Skip to finish' : 'Skip drill'}
                    </Button>
                  </div>
                </div>
                {drill.cue ? (
                  <div className="px-1">
                    <h2 className="m-0 text-[15px] font-medium text-faint">Coach cue</h2>
                    <p className="m-0 mt-3 flex gap-3 text-[17px]">
                      <span aria-hidden="true" className="mt-2 size-2 flex-none bg-volt" />
                      {drill.cue}
                    </p>
                  </div>
                ) : null}
              </section>
            </div>

            <LogForm
              key={drill.position}
              drill={drill}
              existing={logs.get(drill.position)}
              autoRounds={timer ? roundsCompleted(timer) : Number(drill.prescription.rounds ?? 0)}
              coach={coach}
              last={last}
              onSaved={onSaved}
              session={session}
              date={date}
            />

            {drills.length > index + 1 ? (
              <section aria-labelledby="next-title">
                <h2 id="next-title" className="m-0 text-[15px] font-medium text-faint">
                  Up next
                </h2>
                <ol className="m-0 mt-3 grid list-none grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-2 p-0">
                  {drills.slice(index + 1).map((d) => (
                    <li key={d.position} className="bg-[#1b1b1b] p-3">
                      <p className="m-0 text-[15px] font-medium">{d.title}</p>
                      <p className="m-0 mt-0.5 text-[13px] text-faint">{describePrescription(d.type, d.prescription)}</p>
                    </li>
                  ))}
                </ol>
              </section>
            ) : null}
          </>
        ) : (
          <section aria-labelledby="end-title" className="flex flex-col items-start gap-5 bg-[#1b1b1b] p-6 md:p-10">
            <h1 id="end-title" className="m-0 font-display text-[48px] font-normal uppercase leading-[0.95] md:text-[64px]">
              {completed ? 'Session done' : 'Finish the session'}
            </h1>
            <p className="m-0 text-[16px] text-line">
              {logs.size} of {drills.length} {drills.length === 1 ? 'drill' : 'drills'} logged.
            </p>
            <ol className="m-0 flex w-full max-w-xl list-none flex-col p-0">
              {drills.map((d, i) => (
                <li key={d.position} className="flex items-center justify-between gap-3 border-b border-[#2b2b2d] py-2.5">
                  <span className="text-[16px]">
                    {d.title}
                    <span className="block text-[13px] text-faint">{logs.has(d.position) ? 'Logged' : 'Skipped'}</span>
                  </span>
                  <button type="button" onClick={() => goTo(i)} className="min-h-11 text-[15px] font-medium underline underline-offset-4">
                    {logs.has(d.position) ? 'Edit' : 'Log'}
                    <span className="sr-only"> {d.title}</span>
                  </button>
                </li>
              ))}
            </ol>
            {finishError ? (
              <p role="alert" className="m-0 text-[15px] font-medium text-[#ff8a8a]">
                {finishError}
              </p>
            ) : null}
            {completed ? (
              <Link href="/today" className={buttonClass({ variant: 'volt' })}>
                Back to Today
              </Link>
            ) : logs.size ? (
              <Button variant="volt" onClick={finish} disabled={!hydrated || finishing}>
                {finishing ? 'Finishing…' : 'Finish session'}
              </Button>
            ) : (
              <p className="m-0 text-[15px] text-faint">Log at least one drill to finish.</p>
            )}
          </section>
        )}
      </main>
    </div>
  );
}
