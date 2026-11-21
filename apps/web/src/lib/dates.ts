import { addDays } from '@fitsphere/core';

const fmt = new Intl.DateTimeFormat('en-IN', { timeZone: 'UTC', day: 'numeric', month: 'short' });

/** "15 Dec" for an ISO date (YYYY-MM-DD), optionally some days later. The date has no time, so it is read as UTC. */
export function shortDate(iso: string, plusDays = 0): string {
  return fmt.format(new Date(`${addDays(iso, plusDays)}T00:00:00Z`));
}
