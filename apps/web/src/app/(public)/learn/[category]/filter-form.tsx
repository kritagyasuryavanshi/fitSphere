'use client';

import type { ReactNode } from 'react';

/** A GET form, so filters live in the URL. A change submits it; the button covers no-JS visitors. */
export function FilterForm({ children }: { children: ReactNode }) {
  return (
    <form method="get" onChange={(e) => e.currentTarget.requestSubmit()} className="flex flex-col">
      {children}
      <button type="submit" className="mt-4 self-start text-[14px] font-medium underline underline-offset-4">
        Show results
      </button>
    </form>
  );
}
