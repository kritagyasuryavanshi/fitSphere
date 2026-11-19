import { adherence, indiaToday, programDay, versionOn } from '@fitsphere/core';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { isUuid } from '@/lib/programs';
import { supabaseServer } from '@/lib/supabase/server';
import { requireRole } from '@/lib/viewer';
import { FeedbackForm } from './feedback-form';

export const metadata: Metadata = { title: 'Athlete · FitSphere Coach' };

const day = new Intl.DateTimeFormat('en-IN', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
const fmt = (iso: string) => day.format(new Date(`${iso.slice(0, 10)}T00:00:00Z`));
const indiaDay = new Intl.DateTimeFormat('en-IN', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' });
const stamp = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' });
const kg = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 });

type ItemLog = {
  position: number;
  type: string;
  rounds_done: number | null;
  rounds_planned: number | null;
  technique: number | null;
  effort: number | null;
  note: string;
  content_items: { title: string } | null;
  set_logs: { set_no: number; reps: number; load_kg: number | null; rpe: number }[];
};

function result(i: ItemLog) {
  if (i.type === 'sets') {
    return [...i.set_logs]
      .sort((a, b) => a.set_no - b.set_no)
      .map((s) => `${s.load_kg === null ? `${s.reps} reps` : `${s.reps} × ${kg.format(Number(s.load_kg))} kg`} · RPE ${s.rpe}`)
      .join(', ');
  }
  const rounds = i.type === 'rounds' ? `${i.rounds_done} of ${i.rounds_planned} rounds · ` : '';
  return `${rounds}feel ${i.technique} · RPE ${i.effort}`;
}

// K-Athlete: one athlete in one of the coach's programs. RLS returns the enrollment only while it is active and the
// program is the coach's; logs and feedback come through coach_reads_program, profile and answers through coach_can_read.
async function Athlete({ params }: PageProps<'/coach/athletes/[enrollment]'>) {
  await requireRole('coach');
  const { enrollment: id } = await params;
  if (!isUuid(id)) notFound();
  const supabase = await supabaseServer();
  const { data: e, error } = await supabase.from('enrollments').select('id, athlete_id, program_id, start_date, joined_at').eq('id', id).eq('status', 'active').maybeSingle();
  if (error) throw error;
  if (!e) notFound();

  const today = indiaToday();
  const [profile, basics, prefs, versions, count, logs, feedback] = await Promise.all([
    supabase.from('profiles').select('display_name').eq('id', e.athlete_id).maybeSingle(),
    supabase.from('athlete_basics').select('days_per_week, equipment, injury_notes').eq('user_id', e.athlete_id).maybeSingle(),
    supabase.from('athlete_prefs').select('category_id, answers, categories(name)').eq('user_id', e.athlete_id),
    supabase.from('program_versions').select('id, version, effective_from, title, weeks').eq('program_id', e.program_id).not('published_at', 'is', null),
    supabase.rpc('adherence', { athlete: e.athlete_id, program: e.program_id }),
    supabase
      .from('session_logs')
      .select('id, on_date, title, completed_at, note, item_logs(position, type, rounds_done, rounds_planned, technique, effort, note, content_items(title), set_logs(set_no, reps, load_kg, rpe))')
      .eq('athlete_id', e.athlete_id)
      .eq('program_id', e.program_id)
      .gte('on_date', e.start_date)
      .order('on_date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(20),
    supabase.from('feedback').select('id, body, created_at, feedback_replies(id, body, created_at)').eq('athlete_id', e.athlete_id).eq('program_id', e.program_id).order('created_at', { ascending: false }),
  ]);
  for (const r of [profile, basics, prefs, versions, count, logs, feedback]) if (r.error) throw r.error;

  const name = profile.data?.display_name || 'Athlete';
  // Finished sessions only, as the dashboard counts them.
  const lastDone = logs.data!.find((l) => l.completed_at);
  const current = versionOn(versions.data!.map((v) => ({ ...v, effectiveFrom: v.effective_from! })), today);
  const at = current ? programDay(e.start_date, current.weeks!, today) : null;
  const c = count.data![0];
  const percent = adherence(c?.completed ?? 0, c?.scheduled ?? 0);
  const answers = prefs.data!.flatMap((p) =>
    Object.entries((p.answers ?? {}) as Record<string, unknown>).map(([k, v]) => [`${p.categories?.name ?? p.category_id}: ${k.replace(/_/g, ' ')}`, Array.isArray(v) ? v.join(', ') : String(v)]),
  );

  return (
    <>
      <Link href="/coach" className="self-start text-[14px] font-medium underline underline-offset-4">
        All athletes
      </Link>
      <div className="flex flex-col gap-2">
        <h1 className="m-0 font-display text-[48px] font-normal uppercase leading-[0.95] md:text-[64px]">{name}</h1>
        <p className="m-0 text-[15px] text-muted">
          {current?.title ?? 'Program'} · {at ? `week ${at.week}` : 'finished'} · joined {indiaDay.format(new Date(e.joined_at))}
        </p>
      </div>

      <dl aria-label="Summary" className="m-0 grid grid-cols-2 gap-2 md:grid-cols-3">
        <div className="flex flex-col gap-1 bg-mist p-4 md:p-5">
          <dt className="text-[14px] text-muted">Adherence</dt>
          <dd className="m-0 flex flex-col gap-1">
            <span className="font-display text-[36px] leading-none md:text-[44px]">{percent === null ? '–' : `${percent}%`}</span>
            <span className="text-[14px] text-ink-soft">
              {c?.completed ?? 0} of {c?.scheduled ?? 0} sessions
            </span>
          </dd>
        </div>
        <div className="flex flex-col gap-1 bg-mist p-4 md:p-5">
          <dt className="text-[14px] text-muted">Last session</dt>
          <dd className="m-0 flex flex-col gap-1">
            <span className="font-display text-[36px] leading-none md:text-[44px]">{lastDone ? fmt(lastDone.on_date) : '–'}</span>
            <span className="text-[14px] text-ink-soft">{lastDone ? lastDone.title || 'Session' : 'None finished yet'}</span>
          </dd>
        </div>
      </dl>

      <div className="flex flex-wrap items-start gap-8">
        <div className="flex min-w-0 flex-[2_1_520px] flex-col gap-8">
          <section aria-labelledby="logs" className="flex flex-col gap-3">
            <h2 id="logs" className="m-0 text-[20px] font-semibold">
              Session logs
            </h2>
            {logs.data!.length ? (
              <ul className="m-0 flex list-none flex-col gap-4 p-0">
                {logs.data!.map((l) => (
                  <li key={l.id} className="flex flex-col gap-2 border-t border-line pt-3">
                    <p className="m-0 text-[15px] font-medium">
                      {fmt(l.on_date)} · {l.title || 'Session'} {l.completed_at ? '' : <span className="text-muted">· not finished</span>}
                    </p>
                    <ul className="m-0 flex list-none flex-col gap-1 p-0 text-[15px]">
                      {[...l.item_logs]
                        .sort((a, b) => a.position - b.position)
                        .map((i) => (
                          <li key={i.position}>
                            <span className="font-medium">{i.content_items?.title ?? 'No longer in the library'}</span>
                            <span className="text-ink-soft"> · {result(i as ItemLog)}</span>
                            {i.note ? <span className="text-ink-soft"> · &ldquo;{i.note}&rdquo;</span> : null}
                          </li>
                        ))}
                    </ul>
                    {l.note ? <p className="m-0 bg-mist p-3 text-[15px]">Note to you: {l.note}</p> : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="m-0 text-[15px] text-muted">No sessions logged in this program yet.</p>
            )}
            <p className="m-0 text-[13px] text-muted">All logs are self-reported by the athlete.</p>
          </section>

          <section aria-labelledby="answers" className="flex flex-col gap-3">
            <h2 id="answers" className="m-0 text-[20px] font-semibold">
              Sign-up answers
            </h2>
            <dl className="m-0 grid grid-cols-[max-content_1fr] gap-x-6 gap-y-2 text-[15px]">
              <dt className="text-muted">Days per week</dt>
              <dd className="m-0">{basics.data?.days_per_week ?? '–'}</dd>
              <dt className="text-muted">Equipment</dt>
              <dd className="m-0">{basics.data?.equipment?.length ? basics.data.equipment.join(', ') : 'None given'}</dd>
              <dt className="text-muted">Limits</dt>
              <dd className="m-0">{basics.data?.injury_notes || 'None given'}</dd>
              {answers.map(([k, v]) => (
                <div key={k} className="contents">
                  <dt className="text-muted">{k}</dt>
                  <dd className="m-0">{v}</dd>
                </div>
              ))}
            </dl>
            <p className="m-0 text-[13px] text-muted">You see this while {name} is in your program. If they leave, access ends at once.</p>
          </section>
        </div>

        <aside aria-labelledby="feedback" className="flex min-w-0 flex-[1_1_320px] flex-col gap-5 border border-line p-5">
          <h2 id="feedback" className="m-0 text-[20px] font-semibold">
            Give feedback
          </h2>
          <FeedbackForm enrollment={e.id} name={name} />
          {feedback.data!.length ? (
            <ul aria-label="Feedback sent" className="m-0 flex list-none flex-col gap-4 border-t border-line p-0 pt-4">
              {feedback.data!.map((f) => (
                <li key={f.id} className="flex flex-col gap-2">
                  <p className="m-0 text-[13px] text-muted">You · {stamp.format(new Date(f.created_at))}</p>
                  <p className="m-0 whitespace-pre-line text-[15px]">{f.body}</p>
                  {[...f.feedback_replies]
                    .sort((a, b) => a.created_at.localeCompare(b.created_at))
                    .map((r) => (
                      <p key={r.id} className="m-0 ml-4 whitespace-pre-line border-l-2 border-line pl-3 text-[15px] text-ink-soft">
                        <span className="block text-[13px] text-muted">
                          {name} · {stamp.format(new Date(r.created_at))}
                        </span>
                        {r.body}
                      </p>
                    ))}
                </li>
              ))}
            </ul>
          ) : null}
          <Link
            href={`/coach/programs/${e.program_id}/members/${e.id}/remove`}
            className="self-start border-t border-line pt-4 text-[14px] font-medium text-danger underline underline-offset-4"
          >
            Remove from program
          </Link>
        </aside>
      </div>
    </>
  );
}

export default function AthletePage(props: PageProps<'/coach/athletes/[enrollment]'>) {
  return (
    <main className="mx-auto flex w-full max-w-[1200px] flex-col gap-6 px-4 pb-24 pt-8 md:px-10">
      <Suspense fallback={null}>
        <Athlete {...props} />
      </Suspense>
    </main>
  );
}
