// Dates are ISO strings (YYYY-MM-DD) so the rule never depends on the server's time zone.

/** The 18+ rule. A 29 February birthday counts as 1 March in a non-leap year, as Postgres does. */
export function isAdult(dob: string, today: string): boolean {
  const eighteenth = `${String(Number(dob.slice(0, 4)) + 18).padStart(4, '0')}${dob.slice(4)}`;
  // ISO strings compare in date order, and "2026-02-29" sorts between 28 February and 1 March.
  return today >= eighteenth;
}

/** Joins the three date-of-birth fields into an ISO date, or null when they are not a real date. */
export function parseDob(day: string, month: string, year: string): string | null {
  const [d, m, y] = [day.trim(), month.trim(), year.trim()] as const;
  if (!/^\d{1,2}$/.test(d) || !/^\d{1,2}$/.test(m) || !/^\d{4}$/.test(y) || Number(y) < 1900) return null;
  const date = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
  const iso = date.toISOString().slice(0, 10);
  // Date rolls 31 April over to 1 May; a real date survives the round trip.
  return iso === `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}` ? iso : null;
}

/** Today's date in India, where every FitSphere user lives in v1. */
export function indiaToday(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(now);
}
