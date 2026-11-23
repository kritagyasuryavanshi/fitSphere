'use client';

import './globals.css';

// The last net: the root layout itself failed, so this page brings its own html and body.
export default function GlobalError({ retry }: { error: unknown; retry: () => void }) {
  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col items-start justify-center gap-5 bg-ink px-4 text-paper md:px-10">
        <h1 className="m-0 text-[40px] font-bold uppercase leading-none">Something went wrong</h1>
        <p className="m-0 max-w-[520px] text-[18px] leading-[1.5]">FitSphere did not load. Try again in a moment.</p>
        <button type="button" onClick={() => retry()} className="min-h-12 cursor-pointer rounded-pill bg-volt px-7 py-3.5 text-[16px] font-medium text-ink">
          Try again
        </button>
      </body>
    </html>
  );
}
