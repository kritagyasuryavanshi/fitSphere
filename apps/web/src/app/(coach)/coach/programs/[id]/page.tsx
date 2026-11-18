import { Tag } from '@fitsphere/ui';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import type { DraftSession, Numbers, PrescriptionType } from '@/lib/program-draft';
import { supabaseServer } from '@/lib/supabase/server';
import { requireRole } from '@/lib/viewer';
import { Builder, type LibraryItem } from './builder';

export const metadata: Metadata = { title: 'Program builder · FitSphere Coach' };

async function Load({ params, searchParams }: PageProps<'/coach/programs/[id]'>) {
  const viewer = await requireRole('coach');
  const { id } = await params;
  const { saved } = await searchParams;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const supabase = await supabaseServer();
  const [program, library] = await Promise.all([
    supabase
      .from('programs')
      .select(
        'id, title, summary, weeks, updated_at, program_versions(id, version, published_at, program_sessions(id, week, day, position, title, session_items(id, position, item_id, type, prescription, cue, content_items(title, status))))',
      )
      .eq('id', id)
      .eq('coach_id', viewer.userId)
      .maybeSingle(),
    supabase.from('content_items').select('id, title, disciplines!inner(name, category_id, categories!inner(name, sort))').eq('status', 'published').order('title').limit(500),
  ]);
  if (program.error) throw program.error;
  if (library.error) throw library.error;
  const p = program.data;
  if (!p) notFound();

  const draft = p.program_versions.find((v) => !v.published_at);
  const live = p.program_versions.filter((v) => v.published_at).sort((a, b) => b.version - a.version)[0];
  const sessions: DraftSession[] = [...(draft?.program_sessions ?? [])]
    .sort((a, b) => a.position - b.position)
    .map((s) => ({
      key: s.id,
      week: s.week,
      day: s.day,
      title: s.title,
      items: [...s.session_items]
        .sort((a, b) => a.position - b.position)
        .map((it) => ({
          key: it.id,
          item: it.item_id,
          // Unpublished since it was added: someone else's drill has no readable title, and the coach's own one is
          // readable but no longer published. Both block saving, so both are marked for the coach to remove.
          title: it.content_items?.title ?? 'A drill',
          unavailable: it.content_items?.status !== 'published',
          type: it.type as PrescriptionType,
          ...(it.prescription as Numbers),
          cue: it.cue,
        })),
    }));
  const items: LibraryItem[] = library.data
    .sort((a, b) => a.disciplines.categories.sort - b.disciplines.categories.sort || a.title.localeCompare(b.title))
    .map((c) => ({ id: c.id, title: c.title, categoryId: c.disciplines.category_id, categoryName: c.disciplines.categories.name, discipline: c.disciplines.name }));

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <Tag variant="outline">Draft · v{draft?.version ?? 1}</Tag>
        {live ? <Tag variant="success">Live · v{live.version}</Tag> : null}
      </div>
      {/* Every save moves updated_at, so the builder starts again from what was saved, with nothing unsaved. */}
      <Builder
        key={p.updated_at}
        program={{ id: p.id, title: p.title, summary: p.summary, weeks: p.weeks }} sessions={sessions} library={items} saved={saved === '1'} />
    </>
  );
}

export default function BuilderPage(props: PageProps<'/coach/programs/[id]'>) {
  return (
    <main className="mx-auto flex w-full max-w-[1200px] flex-col gap-6 px-4 pb-20 pt-8 md:px-10">
      <Link href="/coach/programs" className="self-start text-[14px] font-medium underline underline-offset-4">
        All programs
      </Link>
      <Suspense fallback={null}>
        <Load {...props} />
      </Suspense>
    </main>
  );
}
