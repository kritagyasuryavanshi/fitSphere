import { addDays, calendarWeek, indiaToday, programDay, sessionsOn } from '@fitsphere/core';
import { buttonClass } from '@fitsphere/ui';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { describePrescription, type Numbers, type PrescriptionType } from '@/lib/program-draft';
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

async function Today() {
  const viewer = await requireRole('athlete');
  const supabase = await supabaseServer();
  const today = indiaToday();
  const { data: programs, error } = await supabase.rpc('my_programs');
  if (error) throw error;

  if (!programs.length) {
    return (
      <>
        <Header today={today} line={`Welcome, ${viewer.name}`} />
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

  const [sessionRows, categoryRows] = await Promise.all([
    supabase
      .from('program_sessions')
      .select('id, version_id, week, day, position, title, session_items(position, type, prescription, cue, content_items(title, slug, disciplines(category_id)))')
      .in(
        'version_id',
        programs.map((p) => p.version_id),
      ),
    supabase.from('categories').select('id, name'),
  ]);
  if (sessionRows.error) throw sessionRows.error;
  if (categoryRows.error) throw categoryRows.error;
  const categories = new Map(categoryRows.data.map((c) => [c.id, c.name]));
  const byEnrollment = new Map(programs.map((p) => [p.enrollment_id, p]));
  // One plan per enrollment, each on the version in effect today.
  const plans = programs.map((p) => ({ id: p.enrollment_id, startDate: p.start_date, weeks: p.weeks, sessions: sessionRows.data.filter((s) => s.version_id === p.version_id) }));
  const due = sessionsOn(plans, today);
  const week = calendarWeek(today).map((d) => ({ ...d, sessions: sessionsOn(plans, d.date) }));
  const next = due.length
    ? null
    : Array.from({ length: 28 }, (_, i) => addDays(today, i + 1))
        .map((date) => ({ date, sessions: sessionsOn(plans, date) }))
        .find((d) => d.sessions.length);

  return (
    <>
      <Header today={today} line={`${greeting()}, ${viewer.name}`} />
      <p className="m-0 text-[16px] font-medium">{due.length ? `${due.length} ${due.length === 1 ? 'session' : 'sessions'} today` : 'Rest day'}</p>

      <ol aria-label="This week" className="m-0 grid list-none grid-cols-7 gap-1 p-0">
        {week.map((d) => {
          const isToday = d.date === today;
          const ids = [...new Set(d.sessions.map((s) => byEnrollment.get(s.programId)!.category_id))];
          // Phones have about 35 px per day, so they get short labels; wider screens get the full names.
          const full = ids.length ? ids.map((id) => categories.get(id) ?? id).join(' + ') : 'Rest';
          const short = ids.length ? ids.map((id) => shortNames[id] ?? (categories.get(id) ?? id).slice(0, 3)) : ['Rest'];
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

      {due.length ? (
        <ul aria-label="Today's sessions" className="m-0 grid list-none gap-4 p-0 md:grid-cols-2">
          {due.map((s) => {
            const p = byEnrollment.get(s.programId)!;
            const at = programDay(p.start_date, p.weeks, today)!;
            const items = [...s.session_items].sort((a, b) => a.position - b.position);
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
                            {content?.disciplines ? (
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
              Next: {shortDate.format(dateOf(next.date))} · {next.sessions.map((s) => s.title.trim() || byEnrollment.get(s.programId)!.title).join(', ')}
            </p>
          ) : (
            <p className="m-0 text-[15px] text-ink-soft">No more sessions are planned in your programs for the next four weeks.</p>
          )}
        </section>
      )}

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
