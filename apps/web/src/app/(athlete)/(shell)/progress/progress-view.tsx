import { adherence, calendarWeek, indiaToday } from '@fitsphere/core';
import { Tag } from '@fitsphere/ui';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { records, SPORT_GROUPS as SPORTS } from '@/lib/progress';
import { supabaseServer } from '@/lib/supabase/server';
import { WeightForm } from './weight-form';

// C-Progress and G-Progress. Every number comes from the M3-10 rules (docs/plans/m3-metrics.md): SQL adherence,
// hard_sets_per_muscle and skill_ratings, and bestOf / isNewRecord through lib/progress.ts.
const shortDate = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const indiaDay = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' });
const indiaShort = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' });
const kg = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 });
const when = (date: string, today: string) => (date === today ? 'Today' : shortDate.format(new Date(`${date}T00:00:00Z`)));
const bestText = (r: { type: 'load' | 'reps'; value: number; reps: number }) => (r.type === 'load' ? `${kg.format(r.value)} kg × ${r.reps}` : `${r.value} reps`);

function Stat({ label, value, line }: { label: string; value: string; line?: string }) {
  return (
    <div className="flex flex-col gap-1 bg-mist p-4 md:p-5">
      <dt className="text-[14px] text-muted">{label}</dt>
      <dd className="m-0 flex flex-col gap-1">
        <span className="font-display text-[36px] leading-none md:text-[44px]">{value}</span>
        {line ? <span className="text-[14px] text-ink-soft">{line}</span> : null}
      </dd>
    </div>
  );
}

/** The caller checks the athlete role and passes their id; route guards live in each page.tsx. */
export async function ProgressView({ sport, userId }: { sport: keyof typeof SPORTS; userId: string }) {
  const supabase = await supabaseServer();
  const today = indiaToday();
  const week = calendarWeek(today);
  const gym = sport === 'gym';

  const { data: programs, error } = await supabase.rpc('my_programs');
  if (error) throw error;
  const mine = programs.filter((p) => (SPORTS[sport] as readonly string[]).includes(p.category_id));
  // The Progress tab opens here; a gym-only athlete goes straight to their gym progress.
  if (sport === 'training' && !mine.length && programs.some((p) => p.category_id === 'gym')) redirect('/progress/gym');

  const [counts, history, ratings, muscles, weights] = await Promise.all([
    Promise.all(mine.map((p) => supabase.rpc('adherence', { athlete: userId, program: p.program_id }))),
    // shortcut: loads every log of the group, capped at 1,000 by the API; move records into SQL once an athlete nears that.
    supabase
      .from('session_logs')
      .select('on_date, item_logs!inner(item_id, type, content_items(title), set_logs(reps, load_kg))')
      .eq('athlete_id', userId)
      .in('category_id', [...SPORTS[sport]])
      .eq('item_logs.type', 'sets'),
    gym ? Promise.resolve({ data: [], error: null }) : supabase.rpc('skill_ratings', { athlete: userId }),
    gym ? supabase.rpc('hard_sets_per_muscle', { athlete: userId, from_date: week[0]!.date, to_date: week[6]!.date }) : Promise.resolve({ data: [], error: null }),
    gym
      ? supabase.from('body_metrics').select('weight_kg, measured_at').eq('user_id', userId).not('weight_kg', 'is', null).order('measured_at', { ascending: false }).limit(8)
      : Promise.resolve({ data: [], error: null }),
  ]);
  for (const r of [...counts, history, ratings, muscles, weights]) if (r.error) throw r.error;

  const scheduled = counts.reduce((n, r) => n + (r.data![0]?.scheduled ?? 0), 0);
  const completed = counts.reduce((n, r) => n + (r.data![0]?.completed ?? 0), 0);
  const percent = adherence(completed, scheduled);
  const titles = new Map(history.data!.flatMap((l) => l.item_logs.map((i) => [i.item_id, i.content_items?.title ?? ''] as const)));
  const recs = records(history.data!, today)
    .map((r) => ({ ...r, title: titles.get(r.itemId) || 'No longer in the library' }))
    .sort((a, b) => b.best.date.localeCompare(a.best.date) || a.title.localeCompare(b.title));

  // Skill ratings are for drills; their names come from the library.
  const ratingRows = ratings.data as { item_id: string; rating: number; logs: number }[];
  const drillTitles = ratingRows.length
    ? await supabase.from('content_items').select('id, title').in('id', ratingRows.map((r) => r.item_id))
    : { data: [], error: null };
  if (drillTitles.error) throw drillTitles.error;
  const skills = ratingRows
    .map((r) => ({ ...r, title: drillTitles.data!.find((d) => d.id === r.item_id)?.title }))
    .filter((r): r is typeof r & { title: string } => !!r.title)
    .sort((a, b) => a.title.localeCompare(b.title));

  const hardSets = (muscles.data as { sets: number }[]).reduce((n, m) => n + m.sets, 0);
  const mostSets = Math.max(1, ...(muscles.data as { sets: number }[]).map((m) => m.sets));
  const bw = (weights.data as { weight_kg: number | null; measured_at: string }[]).map((w) => ({ kg: Number(w.weight_kg), at: w.measured_at }));
  const bwChange = bw.length > 1 ? Math.round((bw[0]!.kg - bw[bw.length - 1]!.kg) * 10) / 10 : null;
  const noun = gym ? 'Workouts' : 'Sessions';

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="m-0 font-display text-[48px] font-normal uppercase leading-[0.95] md:text-[64px]">Progress</h1>
        <nav aria-label="Training" className="flex gap-1 rounded-[30px] bg-mist p-1">
          {(
            [
              ['/progress', 'Boxing and S&C', !gym],
              ['/progress/gym', 'Gym', gym],
            ] as const
          ).map(([href, label, on]) => (
            <Link
              key={href}
              href={href}
              aria-current={on ? 'page' : undefined}
              className={`inline-flex min-h-11 items-center rounded-[30px] px-4 text-[14px] font-medium ${on ? 'bg-ink text-white' : ''}`}
            >
              {label}
            </Link>
          ))}
        </nav>
      </div>

      {!mine.length && !history.data!.length ? (
        <p className="m-0 bg-mist p-6 text-[16px] text-ink-soft">
          {gym ? 'No gym program yet.' : 'No boxing or S&C program yet.'} Join your coach&rsquo;s program from their invite link, and your progress shows here as you log.
        </p>
      ) : null}

      <dl aria-label="Summary" className="m-0 grid grid-cols-2 gap-2 md:grid-cols-3">
        <Stat label={`${noun} done`} value={String(completed)} line={`of ${scheduled} planned so far`} />
        <Stat label="Adherence" value={percent === null ? '–' : `${percent}%`} line="Completed ÷ scheduled, to today" />
        {gym ? (
          <Stat label="Hard sets this week" value={String(hardSets)} line={`${shortDate.format(new Date(`${week[0]!.date}T00:00:00Z`))} to ${shortDate.format(new Date(`${week[6]!.date}T00:00:00Z`))}`} />
        ) : (
          <Stat label="Skills rated" value={String(skills.length)} line="Drills with a technique feel" />
        )}
      </dl>

      <div className="flex flex-wrap items-start gap-8">
        {gym ? (
          <section aria-labelledby="by-muscle" className="flex min-w-0 flex-[2_1_420px] flex-col gap-3">
            <h2 id="by-muscle" className="m-0 text-[20px] font-semibold">
              Hard sets per muscle, this week
            </h2>
            {muscles.data!.length ? (
              <ul className="m-0 flex list-none flex-col gap-3 p-0">
                {(muscles.data as { muscle_id: string; name: string; sets: number }[]).map((m) => (
                  <li key={m.muscle_id} className="flex flex-col gap-1.5">
                    <div className="flex justify-between text-[15px]">
                      <span>{m.name}</span>
                      <span className="text-muted">
                        {m.sets} {m.sets === 1 ? 'set' : 'sets'}
                      </span>
                    </div>
                    <div aria-hidden="true" className="h-2 bg-mist">
                      <div className="h-full bg-ink" style={{ width: `${(m.sets / mostSets) * 100}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="m-0 text-[15px] text-muted">No hard sets logged this week yet.</p>
            )}
            <p className="m-0 text-[13px] text-muted">A hard set is at least one rep at effort 7 or more, counted for the exercise&rsquo;s main muscle.</p>
          </section>
        ) : (
          <section aria-labelledby="skills" className="flex min-w-0 flex-[2_1_420px] flex-col gap-3">
            <h2 id="skills" className="m-0 text-[20px] font-semibold">
              Skills
            </h2>
            {skills.length ? (
              <ul className="m-0 flex list-none flex-col border-t border-line p-0">
                {skills.map((s) => (
                  <li key={s.item_id} className="flex items-baseline justify-between gap-3 border-b border-line py-2.5 text-[15px]">
                    <span className="font-medium">{s.title}</span>
                    <span className="text-muted">
                      {Number(s.rating).toFixed(1)} / 5 · {s.logs} {s.logs === 1 ? 'log' : 'logs'}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="m-0 text-[15px] text-muted">Log a drill in a session to see its rating here.</p>
            )}
            <p className="m-0 text-[13px] text-muted">Your own technique feel, the average of each drill&rsquo;s last 5 logs. Self-reported.</p>
          </section>
        )}

        {gym ? (
          <section aria-labelledby="bw" className="flex min-w-0 flex-[1_1_300px] flex-col gap-3 border border-line p-5">
            <h2 id="bw" className="m-0 text-[20px] font-semibold">
              Body weight
            </h2>
            {bw.length ? (
              <>
                <p className="m-0 flex flex-col gap-1">
                  <span className="font-display text-[36px] leading-none">{kg.format(bw[0]!.kg)} kg</span>
                  <span className="text-[14px] text-ink-soft">
                    Latest, {when(indiaDay.format(new Date(bw[0]!.at)), today)}
                    {bwChange !== null ? ` · ${bwChange === 0 ? 'no change' : `${bwChange > 0 ? 'up' : 'down'} ${kg.format(Math.abs(bwChange))} kg`} over your last ${bw.length} entries` : ''}
                  </span>
                </p>
                <ul aria-label="Recent weights" className="m-0 flex list-none flex-col border-t border-line p-0 text-[15px]">
                  {bw.map((w) => (
                    <li key={w.at} className="flex justify-between border-b border-line py-2">
                      <span>{indiaShort.format(new Date(w.at))}</span>
                      <span>{kg.format(w.kg)} kg</span>
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
            <WeightForm />
            <p className="m-0 text-[13px] text-muted">Optional. Only you and your current coach see it.</p>
          </section>
        ) : null}
      </div>

      <section aria-labelledby="records" className="flex flex-col gap-3">
        <h2 id="records" className="m-0 text-[20px] font-semibold">
          Records
        </h2>
        {recs.length ? (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-[15px]">
              <thead>
                <tr className="border-b border-line text-[13px] text-muted">
                  <th scope="col" className="py-2 pr-3 font-medium">
                    Exercise
                  </th>
                  <th scope="col" className="py-2 pr-3 font-medium">
                    Best set
                  </th>
                  <th scope="col" className="py-2 pr-3 font-medium">
                    First logged
                  </th>
                  <th scope="col" className="py-2 font-medium">
                    When
                  </th>
                </tr>
              </thead>
              <tbody>
                {recs.map((r) => (
                  <tr key={r.itemId} className="border-b border-line">
                    <th scope="row" className="py-2.5 pr-3 font-normal">
                      {r.title}
                    </th>
                    <td className="py-2.5 pr-3">
                      <span className="inline-flex flex-wrap items-center gap-2">
                        {bestText({ type: r.type, ...r.best })}
                        {r.isNew ? <Tag variant="success">New best</Tag> : null}
                      </span>
                    </td>
                    <td className="py-2.5 pr-3 text-muted">{bestText({ type: r.type, ...r.first })}</td>
                    <td className="py-2.5">{when(r.best.date, today)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="m-0 text-[15px] text-muted">Log sets in a workout to see your records here.</p>
        )}
        <p className="m-0 text-[13px] text-muted">Worked out from your own logs. Self-reported.</p>
      </section>
    </>
  );
}
