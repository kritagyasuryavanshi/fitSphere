'use client';

import { tick, type TimerState } from '@fitsphere/core';
import { useEffect, useRef } from 'react';

/** Keeps the screen on while active, where the browser supports it. The lock drops when the tab hides, so it is taken again on return. */
export function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active || typeof navigator === 'undefined' || !('wakeLock' in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    let stopped = false;
    const take = () =>
      navigator.wakeLock
        .request('screen')
        .then((l) => {
          if (stopped) void l.release().catch(() => {});
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
export function useTicking(timer: TimerState | null, setTimer: (f: (t: TimerState | null) => TimerState | null) => void) {
  const running = !!timer?.running;
  const last = useRef(0);
  useEffect(() => {
    if (!running) return;
    last.current = performance.now();
    const id = setInterval(() => {
      const now = performance.now();
      const passed = now - last.current;
      last.current = now;
      setTimer((t) => (t ? tick(t, passed) : t));
    }, 200);
    return () => clearInterval(id);
  }, [running, setTimer]);
  /** Applies the time since the last tick first, so a pause or skip in a throttled background tab loses nothing. */
  return (change: (t: TimerState) => TimerState) =>
    setTimer((t) => {
      if (!t) return t;
      const now = performance.now();
      const passed = t.running ? now - last.current : 0;
      last.current = now;
      return change(tick(t, passed));
    });
}
