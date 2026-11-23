import { addDays } from '@fitsphere/core';

/**
 * Where an active monthly engagement stands for paying its next month (Decision 1, as start_renewal_checkout checks):
 * 'later' before the window, 'due' from 5 days before the paid date, 'grace' up to 3 days after, null otherwise.
 */
export function renewalState(paidThrough: string, today: string, renewsBySubscription: boolean): 'later' | 'due' | 'grace' | null {
  if (renewsBySubscription) return null;
  if (paidThrough > addDays(today, 5)) return 'later';
  if (paidThrough >= today) return 'due';
  if (paidThrough >= addDays(today, -3)) return 'grace';
  return null;
}
