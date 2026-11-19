import { addDays, calendarWeek, indiaToday, programDay, sessionsOn, versionOn } from '@fitsphere/core';
import { buttonClass } from '@fitsphere/ui';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { describePrescription, type Numbers, type PrescriptionType } from '@/lib/program-draft';
import { playable } from '@/lib/session-player';
import { supabaseServer } from '@/lib/supabase/server';
import { requireRole } from '@/lib/viewer';
import { InviteLinkForm } from './invite-link-form';

export const metadata: Metadata = { title: 'Today · FitSphere' };

const longDate = new Intl.DateTimeFormat('en-IN', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
const shortDate = new Intl.DateTimeFormat('en-IN', { weekday: 'long', day: 'numeric', month: 'short', timeZone: 'UTC' });
// Short names for the week strip on phones; a new category falls back to its first three letters.
const shortNames: Record<string, string> = { boxing: 'Box', sc: 'S&C', gym: 'Gym' };
// Dates are India calendar dates as ISO strings; formatting them at UTC midnight keeps the day unchanged.
const dateOf = (iso: string) => new Date(`${iso}T00:00:00Z`);

function greeting(now = new Date()) {
  const hour = Number(new Intl.DateTimeFormat('en-IN', { hour: 'numeric', hourCycle: 'h23', timeZone: 'Asia/Kolkata' }).format(now));
  return hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
}

function Header({ today, line }: { today: string; line: string }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="m-0 text-[15px] text-muted">
        {longDate.format(dateOf(today))} · {line}
      </p>
      <h1 className="m-0 font-display text-[48px] font-normal uppercase leading-[0.95] md:text-[64px]">Today</h1>
    </div>
  );
}

// The player runs rounds and timed drills; a session with sets waits for the set logger.
function SessionAction({ id, name, date, canPlay, log }: { id: string; name: string; date: string; canPlay: boolean; log?: { completed_at: string | null } }) {
  if (log?.completed_at) {
    return (
      <div className="mt-auto flex flex-wrap items-center gap-3">
        <span className="bg-success-soft px-3 py-1.5 text-[14px] font-medium text-success">Done</span>
        <Link href={`/session/${id}/done?date=${date}`} className="text-[15px] font-medium underline underline-offset-4">
          Review your log<span className="sr-only"> for {name}</span>
        </Link>
      </div>
    );
  }
  if (!canPlay) return null;
  return (
    <Link href={`/session/${id}`} aria-label={`${log ? 'Continue session' : 'Start session'}: ${name}`} className={`${buttonClass()} mt-auto self-start`}>
      {log ? 'Continue session' : 'Start session'}
    </Link>
  );
}

async function Today() {
  const viewer = await requireRole('athlete');
  const supabase = await supabaseServer();
  const today = indiaToday();
  const { data: programs, error } = await supabase.rpc('my_programs');
  if (error) throw error;
  // The newest coach feedback from the last 14 days, also after leaving every program; older ones live on Coach feedback.
  const latestFeedback = await supabase
    .from('feedback')
    .select('id, body, coach_name, created_at')
    .eq('athlete_id', viewer.userId)
    // From midnight India time 13 days ago, not UTC midnight.
    .gte('created_at', `${addDays(today, -13)}T00:00:00+05:30`)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (latestFeedback.error) throw latestFeedback.error;
  const feedbackCard = latestFeedback.data ? (
        <section aria-labelledby="coach-feedback" className="flex flex-col gap-2 border-l-4 border-ink bg-mist p-5">
          <h2 id="coach-feedback" className="m-0 text-[15px] font-semibold">
            Feedback from {latestFeedback.data.coach_name || 'your coach'}
          </h2>
          <p className="m-0 line-clamp-3 whitespace-pre-line text-[16px]">{latestFeedback.data.body}</p>
          <Link href="/account/feedback" className="self-start text-[15px] font-medium underline underline-offset-4">
            Read and reply
          </Link>
        </section>
  ) : null;

  if (!programs.length) {
    return (
      <>
        <Header today={today} line={`Welcome, ${viewer.name}`} />
        {feedbackCard}
        <section aria-labelledby="none" className="flex flex-col items-start gap-4 bg-mist p-6 md:p-8">
          <h2 id="none" className="m-0 font-display text-[32px] font-normal uppercase leading-none">
            No program yet
          </h2>
          <p className="m-0 max-w-[56ch] text-[16px] text-ink-soft">Join your coach&rsquo;s program with their invite link. Or start with the first lessons on the boxing path.</p>
          <InviteLinkForm />
          <div className="flex flex-wrap gap-3">
            <Link href="/learn/boxing" className={buttonClass({ variant: 'light' })}>
              Start the boxing path
            </Link>
            <Link href="/search" className={buttonClass({ variant: 'ghost' })}>
              Search lessons
            </Link>
          </div>
        </section>
      </>
    );
  }

  // The schedule first: every published version of the athlete's programs and their sessions, without drills.
  const [versionRows, categoryRows] = await Promise.all([
    supabase
      .from('program_versions')
      .select('id, program_id, version, effective_from, title, weeks')
      .in(
        'program_id',
        programs.map((p) => p.program_id),
      )
      .not('published_at', 'is', null),
    supabase.from('categories').select('id, name'),
  ]);
  if (versionRows.error) throw versionRows.error;
  if (categoryRows.error) throw categoryRows.error;
  const sessionRows = await supabase
    .from('program_sessions')
    .select('id, version_id, week, day, position, title')
    .in(
      'version_id',
      versionRows.data.map((v) => v.id),
    );
  if (sessionRows.error) throw sessionRows.error;

  const categories = new Map(categoryRows.data.map((c) => [c.id, c.name]));
  const byEnrollment = new Map(programs.map((p) => [p.enrollment_id, p]));
  const versions = versionRows.data.map((v) => ({ ...v, effectiveFrom: v.effective_from! }));
  // Each date follows the version in effect that day, so tomorrow's cell shows a version that starts tomorrow.
  const due = (date: string) =>
    sessionsOn(
      programs.flatMap((p) => {
        const v = versionOn(
          versions.filter((x) => x.program_id === p.program_id),
          date,
        );
        return v ? [{ id: p.enrollment_id, startDate: p.start_date, weeks: v.weeks!, sessions: sessionRows.data.filter((s) => s.version_id === v.id) }] : [];
      }),
      date,
    );
  const todays = due(today);
  const week = calendarWeek(today).map((d) => ({ ...d, sessions: due(d.date) }));
  const next = todays.length
    ? null
    : Array.from({ length: 28 }, (_, i) => addDays(today, i + 1))
        .map((date) => ({ date, sessions: due(date) }))
        .find((d) => d.sessions.length);

  // Drills only for today's sessions. A drill shows as a link only while it is published.
  const itemRows = todays.length
    ? await supabase
        .from('session_items')
        .select('session_id, position, type, prescription, cue, content_items(title, slug, status, disciplines(category_id))')
        .in(
          'session_id',
          todays.map((s) => s.id),
        )
    : { data: [], error: null };
  if (itemRows.error) throw itemRows.error;
  // Today's logs decide Start, Continue or Done on each card.
  const logRows = todays.length
    ? await supabase
        .from('session_logs')
        .select('session_id, completed_at')
        .eq('athlete_id', viewer.userId)
        .eq('on_date', today)
        .in(
          'session_id',
          todays.map((s) => s.id),
        )
    : { data: [], error: null };
  if (logRows.error) throw logRows.error;

  return (
    <>
      <Header today={today} line={`${greeting()}, ${viewer.name}`} />
      <p className="m-0 text-[16px] font-medium">{todays.length ? `${todays.length} ${todays.length === 1 ? 'session' : 'sessions'} today` : 'Rest day'}</p>

      <ol aria-label="This week" className="m-0 grid list-none grid-cols-7 gap-1 p-0">
        {week.map((d) => {
          const isToday = d.date === today;
          const ids = [...new Set(d.sessions.map((s) => byEnrollment.get(s.programId)!.category_id))];
          // Phones have about 35 px per day, so they get short labels; wider screens get the full names.
          const full = ids.length ? ids.map((id) => categories.get(id) ?? id).join(' + ') : 'Rest';
          // Deduplicated: two new sports can share a three-letter fallback.
          const short = ids.length ? [...new Set(ids.map((id) => shortNames[id] ?? (categories.get(id) ?? id).slice(0, 3)))] : ['Rest'];
          return (
            <li
              key={d.date}
              aria-current={isToday ? 'date' : undefined}
              className={`flex min-h-16 flex-col justify-between gap-1 p-1.5 text-[12px] md:p-2 md:text-[13px] ${isToday ? 'bg-ink text-paper' : d.sessions.length ? 'bg-mist' : 'border border-line text-muted'}`}
            >
              <span className="font-semibold">
                {d.name}
                {isToday ? <span className="sr-only"> (Today)</span> : null}
              </span>
              <span className="leading-tight">
                {/* One sport per line, so two sports on one day still fit. */}
                <span className="flex flex-col md:hidden">
                  {short.map((s) => (
                    <span key={s}>{s}</span>
                  ))}
                </span>
                <span className="hidden md:inline">{full}</span>
              </span>
            </li>
          );
        })}
      </ol>

      {todays.length ? (
        <ul aria-label="Today's sessions" className="m-0 grid list-none gap-4 p-0 md:grid-cols-2">
          {todays.map((s) => {
            const p = byEnrollment.get(s.programId)!;
            const at = programDay(p.start_date, p.weeks, today)!;
            const items = itemRows.data.filter((i) => i.session_id === s.id).sort((a, b) => a.position - b.position);
            const name = s.title.trim() || `Week ${at.week}, day ${at.day}`;
            return (
              <li key={`${s.programId}-${s.id}`}>
                <article aria-label={name} className="flex h-full flex-col gap-4 border border-line p-5">
                  <p className="m-0 text-[14px] text-muted">
                    {categories.get(p.category_id)} · {p.title}, week {at.week} · {p.coach_name || 'Coach'}
                  </p>
                  <h2 className="m-0 font-display text-[32px] font-normal uppercase leading-none">{name}</h2>
                  <p className="m-0 text-[14px] text-muted">{items.length ? `${items.length} ${items.length === 1 ? 'drill' : 'drills'}` : 'No drills listed'}</p>
                  <ol className="m-0 flex list-none flex-col border-t border-line p-0">
                    {items.map((it) => {
                      const content = it.content_items;
                      return (
                        <li key={it.position} className="flex flex-col gap-0.5 border-b border-line py-2.5">
                          <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                            {content?.disciplines && content.status === 'published' ? (
                              <Link href={`/learn/${content.disciplines.category_id}/${content.slug}`} className="text-[16px] font-medium underline-offset-4 hover:underline">
                                {content.title}
                              </Link>
                            ) : (
                              <span className="text-[16px] font-medium">No longer in the library</span>
                            )}
                            <span className="text-[14px] text-muted">{describePrescription(it.type as PrescriptionType, it.prescription as Numbers)}</span>
                          </div>
                          {it.cue ? <span className="text-[14px] text-ink-soft">{it.cue}</span> : null}
                        </li>
                      );
                    })}
                  </ol>
                  <SessionAction id={s.id} name={name} date={today} canPlay={playable(items)} log={logRows.data.find((l) => l.session_id === s.id)} />
                </article>
              </li>
            );
          })}
        </ul>
      ) : (
        <section aria-label="Rest day" className="flex flex-col gap-2 bg-mist p-6">
          <p className="m-0 text-[18px] font-medium">No session today. Rest and recover.</p>
          {next ? (
            <p className="m-0 text-[15px] text-ink-soft">
              Next: {shortDate.format(dateOf(next.date))} · {next.sessions.map((s) => s.title.trim() || byEnrollment.get(s.programId)!.title).join(', ')}            </p>
          ) : (
            <p className="m-0 text-[15px] text-ink-soft">No more sessions are planned in your programs for the next four weeks.</p>
          )}
        </section>
      )}

      {feedbackCard}

      <Link href="/account/programs" className="self-start text-[15px] font-medium underline underline-offset-4">
        My programs
      </Link>
    </>
  );
}

// C-Today and G-Today (one screen for every sport), T-TodayEmpty when there is no program.
export default function TodayPage() {
  return (
    <main className="mx-auto flex w-full max-w-[1200px] flex-col gap-6 px-4 pb-24 pt-8 md:px-10">
      <Suspense fallback={null}>
        <Today />
      </Suspense>
    </main>
  );
}
