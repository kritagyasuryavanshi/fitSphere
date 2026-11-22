'use client';

import { useState } from 'react';

const STAR = 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z';

/**
 * The overall rating on X-Review: five native radio buttons drawn as stars, filled up to the one chosen. The radios
 * carry the value and the keyboard; the state only paints the fill.
 */
export function Stars({ name, defaultValue = 0 }: { name: string; defaultValue?: number }) {
  const [value, setValue] = useState(defaultValue);
  return (
    <fieldset className="m-0 border-0 p-0">
      <legend className="pb-2 text-[18px] font-medium">Overall</legend>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <label key={n} className="relative flex h-12 w-12 cursor-pointer items-center justify-center has-focus-visible:outline-2 has-focus-visible:outline-ink">
            <input
              type="radio"
              name={name}
              value={n}
              required
              defaultChecked={n === defaultValue}
              onChange={() => setValue(n)}
              className="sr-only"
              aria-label={`${n} ${n === 1 ? 'star' : 'stars'}`}
            />
            <svg width="32" height="32" viewBox="0 0 24 24" aria-hidden="true" fill={n <= value ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8">
              <path d={STAR} />
            </svg>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
