// Program days map to India calendar dates. Dates are ISO strings (YYYY-MM-DD), compared as UTC midnights,
// so there is no clock or time-zone drift in the maths. The start date is the India date of joining.

const DAY = 86_400_000;
const toMs = (iso: string) => Date.parse(`${iso}T00:00:00Z`);

export function addDays(iso: string, days: number): string {
  return new Date(toMs(iso) + days * DAY).toISOString().slice(0, 10);
}

export type PublishedVersion = { id: string; version: number; effectiveFrom: string };

/** The version that applies on a date: the same rule as version_in_effect in the database. */
export function versionOn<V extends PublishedVersion>(versions: V[], date: string): V | undefined {
  const started = versions.filter((v) => v.effectiveFrom <= date).sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom) || b.version - a.version);
  return started[0] ?? [...versions].sort((a, b) => a.version - b.version)[0];
}

const weekdays =['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

/** The calendar week (Monday to Sunday) that holds a date, for the week strip on Today. */
export function calendarWeek(iso: string): { date: string; name: (typeof weekdays)[number] }[] {
  // getUTCDay: 0 is Sunday. Shift so Monday is 0.
  const monday = addDays(iso, -((new Date(toMs(iso)).getUTCDay() + 6) % 7));
  return weekdays.map((name, i) => ({ date: addDays(monday, i), name }));
}

/** Which program week and day a date is, counting the start date as week 1 day 1; null outside the program. */
export function programDay(startDate: string, weeks: number, date: string): { week: number; day: number } | null {
  const offset = Math.round((toMs(date) - toMs(startDate)) / DAY);
  if (offset < 0 || offset >= weeks * 7) return null;
  return { week: Math.floor(offset / 7) + 1, day: (offset % 7) + 1 };
}

export type PlanSession = { week: number; day: number; position: number };
export type Plan<S extends PlanSession> = { id: string; startDate: string; weeks: number; sessions: S[] };

/** Every session due on a date across a person's programs: program order first, then session order. */
export function sessionsOn<S extends PlanSession>(plans: Plan<S>[], date: string): (S & { programId: string })[] {
  return plans.flatMap((plan) => {
    const at = programDay(plan.startDate, plan.weeks, date);
    if (!at) return [];
    return plan.sessions
      .filter((s) => s.week === at.week && s.day === at.day)
      .sort((a, b) => a.position - b.position)
      .map((s) => ({ ...s, programId: plan.id }));
  });
}
