'use client';

import { useEffect, useRef, useState } from 'react';

/** The muted sports montage behind sign-in. It starts paused for reduced motion, and a button stops it (WCAG 2.2.2). */
export function SportsVideo() {
  const ref = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const v = ref.current;
    if (!v || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    v.play().then(() => setPlaying(true), () => setPlaying(false));
  }, []);

  function toggle() {
    const v = ref.current;
    if (!v) return;
    if (v.paused) v.play().then(() => setPlaying(true), () => setPlaying(false));
    else {
      v.pause();
      setPlaying(false);
    }
  }

  return (
    <>
      <video
        ref={ref}
        aria-hidden="true"
        muted
        loop
        playsInline
        preload="metadata"
        poster="/video/sports-poster.jpg"
        className="absolute inset-0 h-full w-full object-cover"
      >
        <source src="/video/sports.webm" type="video/webm" />
        <source src="/video/sports.mp4" type="video/mp4" />
      </video>
      <button
        type="button"
        onClick={toggle}
        className="absolute right-4 top-4 z-10 inline-flex min-h-11 items-center rounded-pill bg-black/40 px-4 text-[13px] font-medium text-paper backdrop-blur hover:bg-black/60 focus-visible:outline-paper md:right-8 md:top-7"
      >
        {playing ? 'Pause video' : 'Play video'}
      </button>
    </>
  );
}
