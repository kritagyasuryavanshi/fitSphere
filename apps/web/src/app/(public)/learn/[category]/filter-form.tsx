'use client';

import type { ReactNode } from 'react';

/** A GET form, so filters live in the URL. A choice submits it; typed fields wait for the button, so moving between them loses nothing. */
export function FilterForm({ children }: { children: ReactNode }) {
  return (
    <form method="get" onChange={(e) => {
        if (!(e.target instanceof HTMLInputElement && e.target.type === 'text')) e.currentTarget.requestSubmit();
      }} className="flex flex-col">
      {children}
      <button type="submit" className="mt-4 self-start text-[14px] font-medium underline underline-offset-4">
        Show results
      </button>
    </form>
  );
}
