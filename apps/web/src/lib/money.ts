/**
 * A typed rupee price as whole paise, or null. String maths only, so 1.1 never becomes 110.00000000000001.
 * Commas are allowed (Indian or Western grouping); at most two decimals and seven rupee digits (the database caps the price).
 */
export function rupeesToPaise(typed: string): number | null {
  const m = /^(\d{1,7})(?:\.(\d{1,2}))?$/.exec(typed.trim().replace(/,/g, ''));
  if (!m) return null;
  return Number(m[1]) * 100 + Number((m[2] ?? '').padEnd(2, '0'));
}

/** Paise as a rupee amount for an input field: whole rupees plain, otherwise two decimals. */
export function paiseToRupees(paise: number): string {
  const rupees = Math.floor(paise / 100);
  const rest = paise % 100;
  return rest ? `${rupees}.${String(rest).padStart(2, '0')}` : String(rupees);
}
