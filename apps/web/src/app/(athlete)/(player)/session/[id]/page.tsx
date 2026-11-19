import { indiaToday } from '@fitsphere/core';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import type { Numbers, PrescriptionType } from '@/lib/program-draft';
import { isUuid } from '@/lib/programs';
import { isIsoDate, playable } from '@/lib/session-player';
import { supabaseServer } from '@/lib/supabase/server';
import { requireRole } from '@/lib/viewer';
import { Player, type PlayerDrill } from './player';

export const metadata: Metadata = { title: 'Session · FitSphere' };

async function Session({ params, searchParams }: PageProps<'/session/[id]'>) {
  const viewer = await requireRole('athlete');
  const { id } = await params;
  const { date: dateParam } = await searchParams;
  const today = indiaToday();
  const date = typeof dateParam === 'string' ? dateParam : today;
  if (!isUuid(id) || !isIsoDate(date) || date > today) notFound();

  const supabase = await supabaseServer();
  // Only a session the athlete's active enrollment schedules on this date opens; the same check guards saving.
  const { data: scheduled, error } = await supabase.rpc('scheduled_session', { session: id, on_date: date });
  if (error) throw error;
  const sched = scheduled[0];
  if (!sched) notFound();

  const [session, items, log, programs] = await Promise.all([
    supabase.from('program_sessions').select('week, day, title').eq('id', id).single(),
    supabase
      .from('session_items')
      .select('position, type, prescription, cue, content_items(title, slug, status, disciplines(category_id))')
      .eq('session_id', id)
      .order('position'),
    supabase
      .from('session_logs')
      .select('id, completed_at, item_logs(position, rounds_done, technique, effort, note)')
      .eq('athlete_id', viewer.userId)
      .eq('session_id', id)
      .eq('on_date', date)
      .maybeSingle(),
    supabase.rpc('my_programs'),
  ]);
  for (const r of [session, items, log, programs]) if (r.error) throw r.error;
  if (!playable(items.data!)) notFound();
  const program = programs.data!.find((p) => p.program_id === sched.program_id);

  const drills: PlayerDrill[] = items.data!.map((it) => {
    const c = it.content_items;
    const live = c?.status === 'published' && c.disciplines;
    return {
      position: it.position,
      type: it.type as PrescriptionType,
      prescription: it.prescription as Numbers,
      cue: it.cue,
      title: c?.title ?? 'No longer in the library',
      href: live ? `/learn/${c.disciplines!.category_id}/${c.slug}` : null,
    };
  });
  const logged = (log.data?.item_logs ?? []).map((l) => ({ position: l.position, rounds: l.rounds_done, technique: l.technique, effort: l.effort, note: l.note }));
  const name = session.data!.title.trim() || `Week ${session.data!.week}, day ${session.data!.day}`;
  // The title of the version that scheduled this date, which for a past date may not be today's.
  const line = [sched.program_title, `week ${session.data!.week}`, program?.coach_name].filter(Boolean).join(' · ');

  return (
    <Player
      // Next keeps a visited page's state. Finishing changes the key, so a finished session opens on its summary;
      // saving a drill does not, so a drill skipped earlier stays skipped.
      key={`${date}:${!!log.data?.completed_at}`}
      session={id}
      date={date}
      isToday={date === today}
      title={name}
      line={line}
      coach={program?.coach_name || 'Your coach'}
      drills={drills}
      logged={logged}
      completed={!!log.data?.completed_at}
    />
  );
}

// C-Session and M-Session: the boxing player, full screen without the app's tabs.
export default function SessionPage(props: PageProps<'/session/[id]'>) {
  return (
    <Suspense fallback={null}>
      <Session {...props} />
    </Suspense>
  );
}
