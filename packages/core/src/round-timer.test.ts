import { describe, expect, it } from 'vitest';
import { addTime, clock, pause, resume, roundsCompleted, skip, startTimer, tick } from './round-timer';

const plan = { rounds: 3, workS: 120, restS: 45 };

describe('round timer', () => {
  it('starts in round 1 of work, running', () => {
    expect(startTimer(plan)).toMatchObject({ phase: 'work', round: 1, rounds: 3, remainingMs: 120_000, running: true });
  });

  it('moves work, rest, next round, and is done after the last work, with no rest after it', () => {
    let t = startTimer(plan);
    t = tick(t, 119_000);
    expect(t).toMatchObject({ phase: 'work', round: 1, remainingMs: 1000 });
    t = tick(t, 1000);
    expect(t).toMatchObject({ phase: 'rest', round: 1, remainingMs: 45_000 });
    t = tick(t, 45_000);
    expect(t).toMatchObject({ phase: 'work', round: 2, remainingMs: 120_000 });
    t = tick(t, 120_000 + 45_000);
    expect(t).toMatchObject({ phase: 'work', round: 3 });
    t = tick(t, 120_000);
    expect(t).toMatchObject({ phase: 'done', round: 3, remainingMs: 0, running: false });
    expect(tick(t, 5000)).toEqual(t);
  });

  it('carries a long gap across phases, as after the phone sleeps', () => {
    // 2:00 work + 0:45 rest + 0:30 into round 2.
    expect(tick(startTimer(plan), 195_000)).toMatchObject({ phase: 'work', round: 2, remainingMs: 90_000 });
    expect(tick(startTimer(plan), 10_000_000)).toMatchObject({ phase: 'done' });
  });

  it('goes straight to the next round when there is no rest', () => {
    const t = tick(startTimer({ rounds: 2, workS: 60, restS: 0 }), 60_000);
    expect(t).toMatchObject({ phase: 'work', round: 2, remainingMs: 60_000 });
  });

  it('runs a timed drill as one round', () => {
    const t = startTimer({ rounds: 1, workS: 600, restS: 0 });
    expect(tick(t, 600_000)).toMatchObject({ phase: 'done', round: 1 });
  });

  it('stands still while paused, and resumes where it stopped', () => {
    let t = tick(startTimer(plan), 30_000);
    t = pause(t);
    expect(t.running).toBe(false);
    expect(tick(t, 60_000)).toEqual(t);
    t = tick(resume(t), 1000);
    expect(t).toMatchObject({ phase: 'work', round: 1, remainingMs: 89_000, running: true });
  });

  it('skip ends the rest and starts the next round, or ends a round early', () => {
    const rest = tick(startTimer(plan), 125_000);
    expect(skip(rest)).toMatchObject({ phase: 'work', round: 2, remainingMs: 120_000 });
    expect(skip(startTimer(plan))).toMatchObject({ phase: 'rest', round: 1, remainingMs: 45_000 });
    const last = tick(startTimer(plan), 2 * 165_000);
    expect(skip(last)).toMatchObject({ phase: 'done' });
  });

  it('skip keeps a paused timer paused', () => {
    expect(skip(pause(startTimer(plan)))).toMatchObject({ phase: 'rest', running: false });
  });

  it('cannot resume once done', () => {
    const done = tick(startTimer(plan), 10_000_000);
    expect(resume(done).running).toBe(false);
  });

  it('counts the rounds whose work has finished', () => {
    expect(roundsCompleted(startTimer(plan))).toBe(0);
    expect(roundsCompleted(tick(startTimer(plan), 130_000))).toBe(1);
    expect(roundsCompleted(tick(startTimer(plan), 170_000))).toBe(1);
    expect(roundsCompleted(tick(startTimer(plan), 10_000_000))).toBe(3);
  });

  it('adds time to the current phase, for "Add 30 s" on a rest, and not once done', () => {
    expect(addTime(tick(startTimer({ rounds: 1, workS: 90, restS: 0 }), 60_000), 30_000)).toMatchObject({ phase: 'work', remainingMs: 60_000 });
    const done = tick(startTimer(plan), 10_000_000);
    expect(addTime(done, 30_000)).toEqual(done);
  });

  it('shows the clock as m:ss, rounding up so 0:00 means the end', () => {
    expect(clock(120_000)).toBe('2:00');
    expect(clock(84_001)).toBe('1:25');
    expect(clock(999)).toBe('0:01');
    expect(clock(0)).toBe('0:00');
    expect(clock(3_600_000)).toBe('60:00');
  });
});
