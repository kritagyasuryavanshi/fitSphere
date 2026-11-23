'use client';

import { useEffect, useRef } from 'react';

type TurnstileApi = { render: (el: HTMLElement, opts: Record<string, unknown>) => string; reset: (id: string) => void; remove: (id: string) => void };
declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
const SCRIPT = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

function loadScript(): Promise<TurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT}"]`);
    const s = existing ?? Object.assign(document.createElement('script'), { src: SCRIPT, async: true });
    s.addEventListener('load', () => (window.turnstile ? resolve(window.turnstile) : reject(new Error('Turnstile did not load'))));
    s.addEventListener('error', () => reject(new Error('Turnstile did not load')));
    if (!existing) document.head.appendChild(s);
  });
}

/**
 * M6-11: the Turnstile check, inside a form. It adds the hidden cf-turnstile-response field itself. A token works
 * once, so a new resetKey asks for a fresh one after each send. Renders nothing without NEXT_PUBLIC_TURNSTILE_SITE_KEY.
 */
export function Turnstile({ resetKey, onToken }: { resetKey?: unknown; onToken?: (token: string | undefined) => void }) {
  const box = useRef<HTMLDivElement>(null);
  const widget = useRef<string | null>(null);
  const tokenCb = useRef(onToken);
  useEffect(() => {
    tokenCb.current = onToken;
  }, [onToken]);

  useEffect(() => {
    if (!SITE_KEY || !box.current) return;
    let cancelled = false;
    loadScript()
      .then((api) => {
        if (cancelled || !box.current) return;
        widget.current = api.render(box.current, {
          sitekey: SITE_KEY,
          appearance: 'interaction-only',
          callback: (t: string) => tokenCb.current?.(t),
          'expired-callback': () => tokenCb.current?.(undefined),
        });
      })
      .catch(() => tokenCb.current?.(undefined));
    return () => {
      cancelled = true;
      if (widget.current) window.turnstile?.remove(widget.current);
      widget.current = null;
    };
  }, []);

  useEffect(() => {
    if (widget.current && resetKey !== undefined) {
      window.turnstile?.reset(widget.current);
      tokenCb.current?.(undefined);
    }
  }, [resetKey]);

  return SITE_KEY ? <div ref={box} /> : null;
}
