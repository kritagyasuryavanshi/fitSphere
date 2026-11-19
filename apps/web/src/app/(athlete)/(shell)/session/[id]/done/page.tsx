import { indiaToday } from '@fitsphere/core';
import { buttonClass } from '@fitsphere/ui';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { Suspense } from 'react';
import { isUuid } from '@/lib/programs';
import { isIsoDate } from '@/lib/session-player';
import { minutesBetween, summarise, type SummaryItem } from '@/lib/session-summary';
import { supabaseServer } from '@/lib/supabase/server';
import { requireRole } from '@/lib/viewer';
import { NoteForm } from './note-form';

export const metadata: Metadata = { title: 'Session done · FitSphere' };

const kgFormat = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 });

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 bg-mist p-4 md:p-5">
      <dt className="text-[14px] text-muted">{label}</dt>
      <dd className="m-0 font-display text-[36px] leading-none md:text-[44px]">{value}</dd>
    </div>
  );
}

async function Done({ params, searchParams }: PageProps<'/session/[id]/done'>) {
  const viewer = await requireRole('athlete');
  const { id } = await params;
  const { date: dateParam } = await searchParams;
  const date = typeof dateParam === 'string' ? dateParam : indiaToday();
  if (!isUuid(id) || !isIsoDate(date)) notFound();

  const supabase = await supabaseServer();
  const { data: log, error } = await supabase
    .from('session_logs')
    .select('id, program_id, title, category_id, started_at, completed_at, note, item_logs(position, type, rounds_done, rounds_planned, technique, effort, set_logs(set_no, reps, load_kg))')
    .eq('athlete_id', viewer.userId)
    .eq('session_id', id)
    .eq('on_date', date)
    .maybeSingle();
  if (error) throw error;
  if (!log) notFound();
  if (!log.completed_at) redirect(`/session/${id}?date=${date}`);

  // The plan, for skipped drills and planned rounds. Published sessions stay readable after the athlete leaves.
  const [items, session, programs] = await Promise.all([
    supabase.from('session_items').select('position, type, prescription, content_items(title)').eq('session_id', id).order('position'),
    supabase.from('program_sessions').select('week, version_id, program_versions(title)').eq('id', id).maybeSingle(),
    supabase.rpc('my_programs'),
  ]);
  for (const r of [items, session, programs]) if (r.error) throw r.error;
  const coach = programs.data!.find((p) => p.program_id === log.program_id)?.coach_name || 'your coach';

  const logs = new Map(log.item_logs.map((l) => [l.position, l]));
  const summaryItems: SummaryItem[] = items.data!.map((it) => {
    const l = logs.get(it.position);
    const p = it.prescription as { rounds?: number };
    return {
      position: it.position,
      title: it.content_items?.title ?? 'No longer in the library',
      type: it.type,
      plannedRounds: it.type === 'rounds' ? Number(p.rounds) : null,
      log: l
        ? {
            roundsDone: l.rounds_done,
            technique: l.technique,
            effort: l.effort,
            sets: [...l.set_logs].sort((a, b) => a.set_no - b.set_no).map((s) => ({ reps: s.reps, loadKg: s.load_kg === null ? null : Number(s.load_kg) })),
          }
        : null,
    };
  });
  const s = summarise(summaryItems);
  const minutes = minutesBetween(log.started_at, log.completed_at);
  const drills = summaryItems.filter((i) => i.type !== 'sets');
  const exercises = summaryItems.filter((i) => i.type === 'sets');
  const programTitle = session.data?.program_versions?.title;
  const where = [log.title, programTitle && session.data ? `${programTitle}, week ${session.data.week}` : programTitle].filter(Boolean).join(' · ');

  return (
    <>
      <div className="flex flex-col gap-2">
        <p className="m-0 text-[15px] text-muted">{where}</p>
        <h1 className="m-0 font-display text-[48px] font-normal uppercase leading-[0.95] md:text-[64px]">{log.category_id === 'gym' ? 'Workout done.' : 'Session done.'}</h1>
      </div>

      <dl aria-label="Summary" className="m-0 grid grid-cols-2 gap-2 md:grid-cols-4">
        {minutes !== null ? <Stat label="Time" value={minutes < 1 ? '<1 min' : `${minutes} min`} /> : null}
        <Stat label={exercises.length && !drills.length ? 'Exercises logged' : 'Logged'} value={`${s.itemsLogged} / ${s.items}`} />
        {s.roundsPlanned ? <Stat label="Rounds" value={`${s.roundsDone} / ${s.roundsPlanned}`} /> : null}
        {s.technique !== null ? <Stat label="Technique feel" value={String(s.technique)} /> : null}
        {exercises.length ? <Stat label="Sets" value={String(s.sets)} /> : null}
        {exercises.length && s.volumeKg ? <Stat label="Volume" value={`${kgFormat.format(s.volumeKg)} kg`} /> : null}
      </dl>

      <div className="flex flex-wrap items-start gap-8">
        <section aria-labelledby="your-log" className="flex min-w-0 flex-[2_1_480px] flex-col gap-4">
          <h2 id="your-log" className="m-0 text-[20px] font-semibold">
            Your log
          </h2>
          {drills.length ? (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-[15px]">
                <thead>
                  <tr className="border-b border-line text-[13px] text-muted">
                    <th scope="col" className="py-2 pr-3 font-medium">
                      Drill
                    </th>
                    <th scope="col" className="py-2 pr-3 font-medium">
                      Rounds
                    </th>
                    <th scope="col" className="py-2 pr-3 font-medium">
                      Feel
                    </th>
                    <th scope="col" className="py-2 font-medium">
                      RPE
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {drills.map((d) => (
                    <tr key={d.position} className="border-b border-line">
                      <th scope="row" className="py-2.5 pr-3 font-normal">
                        {d.title}
                      </th>
                      <td className="py-2.5 pr-3">{d.type === 'rounds' ? `${d.log?.roundsDone ?? 0} / ${d.plannedRounds}` : d.log ? 'Done' : '–'}</td>
                      <td className="py-2.5 pr-3">{d.log?.technique ?? 'Skipped'}</td>
                      <td className="py-2.5">{d.log?.effort ?? '–'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
          {exercises.length ? (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-[15px]">
                <thead>
                  <tr className="border-b border-line text-[13px] text-muted">
                    <th scope="col" className="py-2 pr-3 font-medium">
                      Exercise
                    </th>
                    <th scope="col" className="py-2 font-medium">
                      Sets
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {exercises.map((e) => (
                    <tr key={e.position} className="border-b border-line">
                      <th scope="row" className="py-2.5 pr-3 font-normal">
                        {e.title}
                      </th>
                      <td className="py-2.5">
                        {e.log?.sets.length ? e.log.sets.map((x) => (x.loadKg === null ? `${x.reps} reps` : `${x.reps} × ${x.loadKg} kg`)).join(', ') : 'Skipped'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
          <p className="m-0 text-[14px] text-muted">Self-reported. {coach === 'your coach' ? 'Your coach sees' : `${coach} sees`} this log and your note.</p>
        </section>

        <aside className="flex min-w-0 flex-[1_1_300px] flex-col gap-5 border border-line p-5">
          <NoteForm session={id} date={date} coach={coach} initial={log.note} />
          <div className="flex flex-wrap gap-3 border-t border-line pt-5">
            <Link href="/today" className={buttonClass()}>
              Back to Today
            </Link>
            <Link href={`/session/${id}?date=${date}`} className="flex min-h-12 items-center text-[15px] font-medium underline underline-offset-4">
              Edit your log
            </Link>
          </div>
        </aside>
      </div>
    </>
  );
}

// T-SessionDone and G-WorkoutDone: every number comes from the saved logs through summarise().
export default function DonePage(props: PageProps<'/session/[id]/done'>) {
  return (
    <main className="mx-auto flex w-full max-w-[1200px] flex-col gap-6 px-4 pb-24 pt-8 md:px-10">
      <Suspense fallback={null}>
        <Done {...props} />
      </Suspense>
    </main>
  );
}
