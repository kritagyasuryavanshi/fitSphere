/**
 * The boxing round timer (M3-07) as pure state. The player ticks it with the real time that has passed, so a gap
 * (a phone that slept, a background tab) carries across as many phases as it covers. A timed drill is one round
 * with no rest. There is no rest after the last round.
 */
export type TimerPlan = { rounds: number; workS: number; restS: number };
export type TimerPhase = 'work' | 'rest' | 'done';
export type TimerState = { plan: TimerPlan; phase: TimerPhase; round: number; rounds: number; remainingMs: number; running: boolean };

export function startTimer(plan: TimerPlan): TimerState {
  return { plan, phase: 'work', round: 1, rounds: plan.rounds, remainingMs: plan.workS * 1000, running: true };
}

/** The phase after the current one, from its start. */
function advance(t: TimerState): TimerState {
  if (t.phase === 'work') {
    if (t.round >= t.rounds) return { ...t, phase: 'done', remainingMs: 0, running: false };
    if (t.plan.restS > 0) return { ...t, phase: 'rest', remainingMs: t.plan.restS * 1000 };
    return { ...t, round: t.round + 1, remainingMs: t.plan.workS * 1000 };
  }
  if (t.phase === 'rest') return { ...t, phase: 'work', round: t.round + 1, remainingMs: t.plan.workS * 1000 };
  return t;
}

export function tick(t: TimerState, elapsedMs: number): TimerState {
  if (!t.running || t.phase === 'done') return t;
  let state = t;
  let left = elapsedMs;
  while (state.phase !== 'done' && left >= state.remainingMs) {
    left -= state.remainingMs;
    state = advance(state);
  }
  return state.phase === 'done' ? state : { ...state, remainingMs: state.remainingMs - left };
}

export const pause = (t: TimerState): TimerState => ({ ...t, running: false });
export const resume = (t: TimerState): TimerState => (t.phase === 'done' ? t : { ...t, running: true });

/** More time on the current phase, as "Add 30 s" on a rest. */
export const addTime = (t: TimerState, ms: number): TimerState => (t.phase === 'done' ? t : { ...t, remainingMs: t.remainingMs + ms });

/** Skip rest starts the next round; during work it ends the round early. A paused timer stays paused. */
export function skip(t: TimerState): TimerState {
  const next = advance(t);
  return next.phase === 'done' ? next : { ...next, running: t.running };
}

/** Rounds whose work has finished: the default for "Rounds done". */
export function roundsCompleted(t: TimerState): number {
  if (t.phase === 'done') return t.rounds;
  return t.phase === 'rest' ? t.round : t.round - 1;
}

/** m:ss, rounded up, so the clock reads 0:00 only at the end. */
export function clock(ms: number): string {
  const s = Math.ceil(Math.max(0, ms) / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
