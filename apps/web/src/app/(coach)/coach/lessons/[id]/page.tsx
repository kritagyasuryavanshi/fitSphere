import { Tag } from '@fitsphere/ui';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { supabaseServer } from '@/lib/supabase/server';
import { requireRole } from '@/lib/viewer';
import { type Draft, LessonEditor } from './editor';

export const metadata: Metadata = { title: 'Lesson editor · FitSphere Coach' };

const empty: Draft = {
  id: null,
  disciplineId: '',
  kind: 'skill',
  title: '',
  summary: '',
  level: 'beginner',
  durationMin: null,
  equipment: [],
  supports: [],
  videoId: null,
  mistakes: '',
  safety: '',
  steps: [],
  muscles: [],
  learnFirst: [],
};

async function Editor({ params, searchParams }: PageProps<'/coach/lessons/[id]'>) {
  const viewer = await requireRole('coach');
  const { id } = await params;
  const { saved } = await searchParams;
  const supabase = await supabaseServer();
  const [disciplines, muscles, lessons] = await Promise.all([
    supabase.from('disciplines').select('id, name, sort, category_id, categories!inner(name, sort, is_live, uses_supports, uses_muscles)').eq('categories.is_live', true),
    supabase.from('muscles').select('id, name').order('sort'),
    supabase.from('content_items').select('id, title, disciplines!inner(category_id)').eq('status', 'published').order('title'),
  ]);

  let draft = empty;
  let status = 'draft';
  let note: string | null = null;
  if (id !== 'new') {
    if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
    const { data } = await supabase
      .from('content_items')
      .select(
        'id, discipline_id, kind, title, summary, level, duration_min, equipment, supports, video_id, mistakes, safety, status, review_note, content_steps(position, body), content_muscles(muscle_id, is_primary), content_links!content_links_from_id_fkey(to_id, kind, sort)',
      )
      .eq('id', id)
      .eq('author_id', viewer.userId)
      .maybeSingle();
    if (!data) notFound();
    status = data.status;
    note = data.review_note;
    draft = {
      id: data.id,
      disciplineId: data.discipline_id,
      kind: data.kind,
      title: data.title,
      summary: data.summary,
      level: data.level,
      durationMin: data.duration_min,
      equipment: data.equipment,
      supports: data.supports,
      videoId: data.video_id,
      mistakes: data.mistakes,
      safety: data.safety,
      steps: [...data.content_steps].sort((a, b) => a.position - b.position).map((s) => s.body),
      muscles: [...data.content_muscles].sort((a, b) => Number(b.is_primary) - Number(a.is_primary)).map((m) => m.muscle_id),
      learnFirst: data.content_links
        .filter((l) => l.kind === 'prerequisite')
        .sort((a, b) => a.sort - b.sort)
        .map((l) => l.to_id),
    };
  }
  const editable = status === 'draft' || status === 'needs_changes';
  const list = (disciplines.data ?? [])
    .sort((a, b) => a.categories.sort - b.categories.sort || a.sort - b.sort)
    .map((d) => ({ id: d.id, name: d.name, categoryId: d.category_id, categoryName: d.categories.name, usesSupports: d.categories.uses_supports, usesMuscles: d.categories.uses_muscles }));

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="m-0 font-display text-[40px] font-normal uppercase leading-[0.95] md:text-[56px]">{draft.id ? draft.title : 'New lesson'}</h1>
        {saved ? <Tag variant="success">Draft saved</Tag> : null}
      </div>
      {note && status === 'needs_changes' ? (
        <div role="note" className="bg-warning-soft p-4 text-[15px] text-warning">
          <p className="m-0 font-semibold">The reviewer asked for changes</p>
          <p className="m-0 mt-1">{note}</p>
        </div>
      ) : null}
      {editable ? (
        <LessonEditor
          draft={draft}
          disciplines={list}
          muscles={(muscles.data ?? []).map((m) => ({ id: m.id, label: m.name }))}
          lessons={(lessons.data ?? []).map((l) => ({ id: l.id, label: l.title, categoryId: l.disciplines.category_id }))}
        />
      ) : (
        <p className="m-0 text-[16px] text-muted">
          This lesson is {status === 'in_review' ? 'in review' : 'live'}, so it cannot change now.{' '}
          <Link href="/coach/lessons" className="font-medium text-ink underline">
            Back to My lessons
          </Link>
        </p>
      )}
    </>
  );
}

export default function EditorPage(props: PageProps<'/coach/lessons/[id]'>) {
  return (
    <main className="mx-auto flex w-full max-w-[1200px] flex-col gap-6 px-4 pb-20 pt-8 md:px-10">
      <Link href="/coach/lessons" className="self-start text-[14px] font-medium underline underline-offset-4">
        My lessons
      </Link>
      <Suspense fallback={null}>
        <Editor {...props} />
      </Suspense>
    </main>
  );
}
