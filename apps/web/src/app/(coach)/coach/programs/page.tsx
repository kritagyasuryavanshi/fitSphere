import { buttonClass, Tag } from '@fitsphere/ui';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { sessionsKey } from '@/lib/program-draft';
import { supabaseServer } from '@/lib/supabase/server';
import { requireRole } from '@/lib/viewer';

export const metadata: Metadata = { title: 'Programs · FitSphere Coach' };

async function Programs({ searchParams }: PageProps<'/coach/programs'>) {
  const viewer = await requireRole('coach');
  const { published } = await searchParams;
  const supabase = await supabaseServer();
  const { data, error } = await supabase
    .from('programs')
    // RLS shows the coach only active enrollments in their own programs, so the count is current members.
    .select(
      'id, title, weeks, updated_at, categories(name), enrollments(count), program_versions(version, published_at, program_sessions(week, day, position, title, session_items(position, item_id, type, prescription, cue)))',
    )
    .eq('coach_id', viewer.userId)
    .order('updated_at', { ascending: false });
  if (error) throw error;

  const rows = data.map((p) => {
    const live = p.program_versions.filter((v) => v.published_at).sort((a, b) => b.version - a.version)[0];
    const draft = p.program_versions.find((v) => !v.published_at);
    const weeksBuilt = new Set(draft?.program_sessions.map((s) => s.week)).size;
    // Publishing copies the live version into the new draft, so they differ only after a real edit.
    const changed = !!live && !!draft && sessionsKey(draft.program_sessions) !== sessionsKey(live.program_sessions);
    return { ...p, live, weeksBuilt, changed, athletes: p.enrollments[0]?.count ?? 0 };
  });

  return (
    <>
      {typeof published === 'string' ? (
        <p role="status" className="m-0 bg-success-soft p-4 text-[15px] font-medium text-success">
          Published version {published}. Athletes already in the program see it from tomorrow.
        </p>
      ) : null}
      {!rows.length ? (
        <div className="flex flex-col items-start gap-3 bg-mist p-8">
          <p className="m-0 text-[18px] font-medium">No programs yet</p>
          <p className="m-0 text-[16px] text-muted">Build weeks of sessions from the library, then publish and share an invite link.</p>
        </div>
      ) : (
        <ul aria-label="Programs" className="m-0 grid list-none gap-4 p-0 md:grid-cols-2 lg:grid-cols-3">
          {rows.map((p) => (
            <li key={p.id} className="flex flex-col gap-3 border border-line p-5">
              <div className="flex flex-wrap gap-2">
                {p.live ? <Tag variant="success">Live · v{p.live.version}</Tag> : <Tag variant="outline">Draft</Tag>}
                {p.changed ? <Tag variant="warning">Unpublished changes</Tag> : null}
              </div>
              <h2 className="m-0 font-display text-[28px] font-normal uppercase leading-none">{p.title}</h2>
              <p className="m-0 text-[15px] text-muted">
                {p.categories.name} · {p.live ? `${p.weeks} ${p.weeks === 1 ? 'week' : 'weeks'}` : `${p.weeksBuilt} of ${p.weeks} weeks built`} ·{' '}
                {p.athletes ? `${p.athletes} ${p.athletes === 1 ? 'athlete' : 'athletes'}` : 'no athletes yet'}
              </p>
              <div className="flex flex-wrap gap-5">
                <Link href={`/coach/programs/${p.id}`} className="inline-flex min-h-11 items-center text-[15px] font-medium underline underline-offset-4">
                  Edit<span className="sr-only">: {p.title}</span>
                </Link>
                {p.live ? (
                  <Link href={`/coach/programs/${p.id}/invite`} className="inline-flex min-h-11 items-center text-[15px] font-medium underline underline-offset-4">
                    Invite<span className="sr-only">: {p.title}</span>
                  </Link>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

export default function ProgramsPage(props: PageProps<'/coach/programs'>) {
  return (
    <main className="mx-auto flex w-full max-w-[1200px] flex-col gap-6 px-4 pb-20 pt-8 md:px-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="m-0 font-display text-[48px] font-normal uppercase leading-[0.95] md:text-[64px]">Programs</h1>
        <Link href="/coach/programs/new" className={buttonClass()}>
          New program
        </Link>
      </div>
      <p className="m-0 text-[15px] text-muted">Athletes see changes after you publish them.</p>
      <Suspense fallback={null}>
        <Programs {...props} />
      </Suspense>
    </main>
  );
}
