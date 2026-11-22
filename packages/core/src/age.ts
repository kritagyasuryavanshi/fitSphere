// Dates are ISO strings (YYYY-MM-DD). The beta is 18+ (decision-m6-launch); the database enforces it too.

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

/** True from the 18th birthday on. A 29 February birthday turns 18 on 1 March in a common year. */
export function isAdult(dob: string, today: string): boolean {
  return `${Number(dob.slice(0, 4)) + 18}${dob.slice(4)}` <= today;
}
