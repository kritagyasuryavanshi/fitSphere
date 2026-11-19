import { addDays, adherence, calendarWeek, indiaToday, programDay, sessionsOn, versionOn } from '@fitsphere/core';
import { buttonClass } from '@fitsphere/ui';
import Link from 'next/link';
import { coachFlags, type CoachFlag } from '@/lib/coach-flags';
import type { supabaseServer } from '@/lib/supabase/server';

// C-CoachDash and M-C-CoachDash. Only the coach's own active athletes: RLS returns active enrollments in the coach's
// programs, and logs only through coach_reads_program. Adherence is SQL adherence(); flags follow lib/coach-flags.ts.
const LOOKBACK_DAYS = 56;
const shortDate = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const fmt = (iso: string) => shortDate.format(new Date(`${iso}T00:00:00Z`));
const longDate = new Intl.DateTimeFormat('en-IN', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });

type Db = Awaited<ReturnType<typeof supabaseServer>>;

function flagText(f: CoachFlag, lastLog: string | undefined) {
  if (f.type === 'pain') return ['Reported pain', 'Reported pain in the last 7 days.'];
  if (f.type === 'missed') return ['Missed sessions', `${f.count} sessions missed in a row. ${lastLog ? `Last finished ${fmt(lastLog)}.` : 'None finished in the last 8 weeks.'}`];
  return ['High effort', 'Effort 9 or higher in the last two sessions (14 days).'];
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 bg-mist p-4 md:p-5">
      <dt className="text-[14px] text-muted">{label}</dt>
      <dd className="m-0 font-display text-[36px] leading-none md:text-[44px]">{value}</dd>
    </div>
  );
}

export async function Dashboard({ supabase, name, programIds }: { supabase: Db; name: string; programIds: string[] }) {
  const today = indiaToday();
  const week = calendarWeek(today);
  const since = addDays(today, -LOOKBACK_DAYS);

  const [enrollments, versions, logs] = await Promise.all([
    // RLS already limits a coach to active enrollments; the filter keeps it so whatever other read rule appears.
    supabase.from('enrollments').select('id, athlete_id, program_id, start_date').in('program_id', programIds).eq('status', 'active'),
    supabase.from('program_versions').select('id, program_id, version, effective_from, title, weeks').in('program_id', programIds).not('published_at', 'is', null),
    // shortcut: loads the coach's logs from the last 8 weeks in one query; page by athlete past a few hundred athletes.
    supabase
      .from('session_logs')
      .select('athlete_id, program_id, session_id, on_date, created_at, completed_at, note, item_logs(effort, set_logs(rpe))')
      .in('program_id', programIds)
      .gte('on_date', since)
      .order('on_date', { ascending: false })
      .order('created_at', { ascending: false }),
  ]);
  for (const r of [enrollments, versions, logs]) if (r.error) throw r.error;
  const rows = enrollments.data!;
  const byProgram = (programId: string) => versions.data!.filter((v) => v.program_id === programId).map((v) => ({ ...v, effectiveFrom: v.effective_from! }));
  // Only the versions in effect somewhere in the window, so republished programs do not pile up rows.
  const used = new Set<string>();
  for (const e of rows) for (let d = e.start_date > since ? e.start_date : since; d <= week[6]!.date; d = addDays(d, 1)) {
    const v = versionOn(byProgram(e.program_id), d);
    if (v) used.add(v.id);
  }
  const [sessions, profiles, counts] = await Promise.all([
    used.size
      ? supabase.from('program_sessions').select('id, version_id, week, day, position').in('version_id', [...used])
      : Promise.resolve({ data: [], error: null }),
    rows.length ? supabase.from('profiles').select('id, display_name').in('id', [...new Set(rows.map((e) => e.athlete_id))]) : Promise.resolve({ data: [], error: null }),
    // shortcut: one adherence() call per enrollment; move to a set-returning SQL function past ~50 athletes.
    Promise.all(rows.map((e) => supabase.rpc('adherence', { athlete: e.athlete_id, program: e.program_id }))),
  ]);
  for (const r of [sessions, profiles, ...counts]) if (r.error) throw r.error;

  const names = new Map(profiles.data!.map((p) => [p.id, p.display_name || 'Athlete']));
  const board = rows
    .map((e, i) => {
      const own = byProgram(e.program_id);
      // From this enrollment only: an athlete who left and rejoined starts afresh.
      const mine = logs.data!.filter((l) => l.athlete_id === e.athlete_id && l.program_id === e.program_id && l.on_date >= e.start_date);
      const doneKey = new Set(mine.filter((l) => l.completed_at).map((l) => `${l.session_id}|${l.on_date}`));
      // Sessions this enrollment scheduled from the later of its start and the lookback, to the end of this week.
      const scheduled: { date: string; done: boolean }[] = [];
      for (let d = e.start_date > since ? e.start_date : since; d <= week[6]!.date; d = addDays(d, 1)) {
        const v = versionOn(own, d);
        if (!v) continue;
        const plan = { id: e.id, startDate: e.start_date, weeks: v.weeks!, sessions: sessions.data!.filter((s) => s.version_id === v.id) };
        for (const s of sessionsOn([plan], d)) scheduled.push({ date: d, done: doneKey.has(`${s.id}|${d}`) });
      }
      const finished = mine.filter((l) => l.completed_at).map((l) => ({ date: l.on_date, efforts: l.item_logs.flatMap((i) => [...(i.effort ? [i.effort] : []), ...i.set_logs.map((x) => x.rpe)]) }));
      const lastLog = mine.find((l) => l.completed_at)?.on_date;
      const current = versionOn(own, today);
      const at = current ? programDay(e.start_date, current.weeks!, today) : null;
      const c = counts[i]!.data![0];
      return {
        id: e.id,
        name: names.get(e.athlete_id) ?? 'Athlete',
        program: current?.title ?? 'Program',
        where: at ? `wk ${at.week}` : 'finished',
        percent: adherence(c?.completed ?? 0, c?.scheduled ?? 0),
        thisWeek: scheduled.filter((s) => s.date >= week[0]!.date),
        note: mine.find((l) => l.note.trim())?.note.trim(),
        lastLog,
        lastActivity: mine[0]?.on_date,
        // shortcut: pain reports come from the AI guide (journey J6, M5); until then no pain dates exist.
        flags: coachFlags({ scheduled, finished, painDates: [], today, ended: !at }),
      };
    })
    .sort((a, b) => b.flags.length - a.flags.length || a.name.localeCompare(b.name));

  const athletes = new Set(rows.map((e) => e.athlete_id)).size;
  const loggedThisWeek = logs.data!.filter((l) => l.completed_at && l.on_date >= week[0]!.date).length;
  const percents = board.map((b) => b.percent).filter((p): p is number => p !== null);
  const average = percents.length ? Math.floor(percents.reduce((a, b) => a + b, 0) / percents.length) : null;
  const attention = board.flatMap((b) => b.flags.map((f) => ({ ...b, flag: f })));

  return (
    <main className="mx-auto flex w-full max-w-[1440px] flex-col gap-8 px-4 pb-24 pt-8 md:px-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-2">
          <p className="m-0 text-[15px] text-muted">
            Hello, {name} · {longDate.format(new Date(`${today}T00:00:00Z`))}
          </p>
          <h1 className="m-0 font-display text-[48px] font-normal uppercase leading-[0.95] md:text-[64px]">Athletes</h1>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link href="/coach/programs" className={buttonClass({ variant: 'light' })}>
            Invite links
          </Link>
          <Link href="/coach/programs/new" className={buttonClass()}>
            New program
          </Link>
        </div>
      </div>

      <dl aria-label="This week" className="m-0 grid grid-cols-2 gap-2 md:grid-cols-3">
        <Stat label="Active athletes" value={String(athletes)} />
        <Stat label="Sessions logged this week" value={String(loggedThisWeek)} />
        <Stat label="Average adherence" value={average === null ? '–' : `${average}%`} />
      </dl>

      <section aria-labelledby="attention" className="flex flex-col gap-3">
        <h2 id="attention" className="m-0 text-[20px] font-semibold">
          Needs your attention
        </h2>
        {attention.length ? (
          <ul className="m-0 grid list-none gap-3 p-0 md:grid-cols-3">
            {attention.map((a) => {
              const [label, text] = flagText(a.flag, a.lastLog);
              return (
                <li key={`${a.id}-${a.flag.type}`} className="flex flex-col gap-1 border-l-4 border-danger bg-mist p-4">
                  <span className="text-[13px] font-semibold uppercase tracking-wide text-danger">{label}</span>
                  <Link href={`/coach/athletes/${a.id}`} className="text-[17px] font-medium underline underline-offset-4">
                    {a.name}
                  </Link>
                  <span className="text-[14px] text-muted">{a.program}</span>
                  <span className="text-[15px] text-ink-soft">{text}</span>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="m-0 text-[15px] text-muted">Nothing needs your attention. Flags show missed sessions and very high effort.</p>
        )}
      </section>

      <section aria-labelledby="board" className="flex flex-col gap-3">
        <h2 id="board" className="m-0 text-[20px] font-semibold">
          This week
        </h2>
        {board.length ? (
          <>
          {/* Column names for wide screens; each cell also names itself for screen readers and phones. */}
          <div aria-hidden="true" className="hidden border-b border-line pb-2 text-[13px] text-muted md:grid md:grid-cols-[minmax(0,1.4fr)_minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,0.7fr)_minmax(0,2fr)] md:gap-x-4">
            <span>Athlete</span>
            <span>Program</span>
            <span>Mon–Sun</span>
            <span>Adherence</span>
            <span>Latest note</span>
          </div>
          <ul aria-label="Athletes this week" className="m-0 flex list-none flex-col gap-3 p-0 md:gap-0">
            {board.map((b) => (
              // Phones: a stacked card per athlete (decision D3). Wider screens: one row per athlete.
              <li
                key={b.id}
                className="grid grid-cols-2 gap-x-4 gap-y-2 border border-line p-4 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,0.7fr)_minmax(0,2fr)] md:items-center md:border-0 md:border-b md:px-0 md:py-3"
              >
                <Link href={`/coach/athletes/${b.id}`} className="col-span-2 text-[16px] font-medium underline-offset-4 hover:underline md:col-span-1">
                  {b.name}
                  <span className="sr-only">: open logs and give feedback</span>
                </Link>
                <span className="flex flex-col text-[15px]">
                  <span className="text-[13px] text-muted md:sr-only">Program</span>
                  {b.program} · {b.where}
                </span>
                <span className="flex flex-col text-[15px]">
                  <span className="text-[13px] text-muted md:sr-only">Mon–Sun</span>
                  {b.thisWeek.length ? `${b.thisWeek.filter((s) => s.done).length} of ${b.thisWeek.length} done` : 'None scheduled'}
                </span>
                <span className="flex flex-col text-[15px]">
                  <span className="text-[13px] text-muted md:sr-only">Adherence</span>
                  {b.percent === null ? '–' : `${b.percent}%`}
                </span>
                <span className="col-span-2 flex flex-col text-[15px] text-ink-soft md:col-span-1">
                  <span className="text-[13px] text-muted md:sr-only">Latest note</span>
                  {b.note ?? (b.lastActivity ? `No note · last log ${fmt(b.lastActivity)}` : 'No log in the last 8 weeks')}
                </span>
              </li>
            ))}
          </ul>
          </>
        ) : (
          <p className="m-0 bg-mist p-6 text-[16px] text-ink-soft">
            No athletes yet. Share a program&rsquo;s invite link, and athletes who join show up here with their training each week.
          </p>
        )}
        <p className="m-0 text-[13px] text-muted">Adherence = completed ÷ scheduled sessions to date. Logs and notes are self-reported.</p>
      </section>
    </main>
  );
}
