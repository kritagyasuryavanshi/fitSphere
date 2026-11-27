'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

export type Slide = {
  eyebrow: string;
  title: string;
  text: string;
  href: string;
  cta: string;
  /** A photo, or a type-only panel in the given colours when there is no fitting photo. */
  photo?: { src: string; alt: string };
  panel?: { word: string; tone: 'volt' | 'ink' };
};

const INTERVAL_MS = 6000;

/**
 * The landing hero: what FitSphere offers today, one slide at a time. It moves on its own unless the visitor asks
 * for reduced motion, and stops on hover, on focus and with the pause button (WCAG 2.2.2).
 */
export function OfferCarousel({ slides, children }: { slides: Slide[]; children: React.ReactNode }) {
  const [now, setNow] = useState(0);
  const [paused, setPaused] = useState(false);
  const [held, setHeld] = useState(false);
  const [still, setStill] = useState(true);
  const root = useRef<HTMLElement>(null);

  useEffect(() => {
    const q = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setStill(q.matches);
    sync();
    q.addEventListener('change', sync);
    return () => q.removeEventListener('change', sync);
  }, []);

  const moving = !paused && !held && !still && slides.length > 1;
  useEffect(() => {
    if (!moving) return;
    const t = setInterval(() => setNow((n) => (n + 1) % slides.length), INTERVAL_MS);
    return () => clearInterval(t);
  }, [moving, slides.length]);

  const go = (n: number) => setNow((n + slides.length) % slides.length);

  return (
    <section
      ref={root}
      aria-roledescription="carousel"
      aria-label="What FitSphere offers"
      onPointerEnter={(e) => e.pointerType === 'mouse' && setHeld(true)}
      onPointerLeave={(e) => e.pointerType === 'mouse' && setHeld(false)}
      onFocus={() => setHeld(true)}
      onBlur={(e) => {
        if (!root.current?.contains(e.relatedTarget as Node | null)) setHeld(false);
      }}
      className="relative flex min-h-[640px] flex-col justify-end overflow-hidden bg-ink text-paper md:min-h-[720px] [&_:focus-visible]:outline-paper"
    >
      {slides.map((s, i) => (
        <div
          key={s.title}
          aria-hidden="true"
          className={`absolute inset-0 transition-opacity duration-700 motion-reduce:transition-none ${i === now ? 'opacity-100' : 'opacity-0'}`}
        >
          {s.photo ? (
            <Image
              src={s.photo.src}
              alt=""
              fill
              priority={i === 0}
              sizes="100vw"
              className="object-cover opacity-60"
            />
          ) : (
            <div
              className={`flex h-full items-start justify-end overflow-hidden p-6 md:p-10 ${s.panel?.tone === 'volt' ? 'bg-volt text-ink' : 'bg-ink-soft text-paper'}`}
            >
              <span className="font-display text-[clamp(96px,18vw,260px)] uppercase leading-[0.8] opacity-25">
                {s.panel?.word}
              </span>
            </div>
          )}
        </div>
      ))}
      {/* Darkens the background under the text, so the white words stay readable on a phone. */}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-gradient-to-t from-ink via-ink/60 to-transparent"
      />

      <div className="relative mx-auto flex w-full max-w-[1440px] flex-col gap-8 px-4 pb-10 pt-24 md:px-10 md:pb-14">
        {children}
        <div className="grid gap-6 border-t border-paper/30 pt-6 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
          <div aria-live={moving ? 'off' : 'polite'}>
            {slides.map((s, i) => (
              <div
                key={s.title}
                role="group"
                aria-roledescription="slide"
                aria-label={`${i + 1} of ${slides.length}: ${s.eyebrow}`}
                hidden={i !== now}
                className="flex max-w-[640px] flex-col items-start gap-2"
              >
                <p className="m-0 text-[13px] font-semibold uppercase tracking-wide text-volt">{s.eyebrow}</p>
                <h2 className="m-0 text-[24px] font-semibold leading-tight md:text-[28px]">{s.title}</h2>
                <p className="m-0 text-[16px] leading-[1.5] text-mist">{s.text}</p>
                <Link
                  href={s.href}
                  className="mt-1 text-[16px] font-medium text-paper underline underline-offset-4 hover:text-volt"
                >
                  {s.cta}
                </Link>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {/* Under reduced motion the slides never move, so there is nothing to pause. */}
            {still ? null : (
              <button
                type="button"
                onClick={() => setPaused((p) => !p)}
                className="inline-flex min-h-11 items-center rounded-pill border border-paper/60 px-4 text-[14px] font-medium"
                aria-label={paused ? 'Play slides' : 'Pause slides'}
              >
                {paused ? 'Play' : 'Pause'}
              </button>
            )}
            <button
              type="button"
              onClick={() => go(now - 1)}
              aria-label="Previous slide"
              className="inline-flex size-11 items-center justify-center rounded-pill border border-paper/60"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                aria-hidden="true"
              >
                <path d="M15 5l-7 7 7 7" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => go(now + 1)}
              aria-label="Next slide"
              className="inline-flex size-11 items-center justify-center rounded-pill border border-paper/60"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                aria-hidden="true"
              >
                <path d="M9 5l7 7-7 7" />
              </svg>
            </button>
            <div className="flex items-center">
              {slides.map((s, i) => (
                <button
                  key={s.title}
                  type="button"
                  onClick={() => go(i)}
                  aria-label={`Show ${s.eyebrow}`}
                  aria-current={i === now ? 'true' : undefined}
                  className="flex size-11 items-center justify-center"
                >
                  <span
                    className={`block h-2 rounded-pill transition-all motion-reduce:transition-none ${i === now ? 'w-6 bg-volt' : 'w-2 bg-paper/50'}`}
                  />
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
