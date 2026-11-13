import { buttonClass, Tag, type TagVariant } from '@fitsphere/ui';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { supabaseServer } from '@/lib/supabase/server';
import { requireRole } from '@/lib/viewer';

export const metadata: Metadata = { title: 'My lessons · FitSphere Coach' };

const statuses: Record<string, { label: string; tab: string; variant: TagVariant; action: string }> = {
  draft: { label: 'Draft', tab: 'Drafts', variant: 'outline', action: 'Edit' },
  in_review: { label: 'In review', tab: 'In review', variant: 'warning', action: 'View' },
  needs_changes: { label: 'Needs changes', tab: 'Needs changes', variant: 'danger', action: 'Fix and resubmit' },
  published: { label: 'Live', tab: 'Live', variant: 'success', action: 'Open' },
};
const kinds: Record<string, string> = { skill: 'Skill lesson', drill: 'Drill', exercise: 'Exercise' };
const day = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' });

async function Lessons({ searchParams }: PageProps<'/coach/lessons'>) {
  const viewer = await requireRole('coach');
  const { status, submitted } = await searchParams;
  const supabase = await supabaseServer();
  const { data, error } = await supabase
    .from('content_items')
    .select('id, slug, title, kind, status, review_note, video_broken, updated_at, disciplines(category_id)')
    .eq('author_id', viewer.userId)
    .order('updated_at', { ascending: false });
  if (error) throw error;
  const filter = typeof status === 'string' && status in statuses ? status : null;
  const shown = filter ? data.filter((i) => i.status === filter) : data;
  const href = (i: (typeof data)[number]) => (i.status === 'published' ? `/learn/${i.disciplines.category_id}/${i.slug}` : `/coach/lessons/${i.id}`);
  const tabs: [string, string][] = [['all', 'All'], ...Object.entries(statuses).map(([k, v]): [string, string] => [k, v.tab])];

  return (
    <>
      {submitted ? (
        <p role="status" className="m-0 bg-success-soft p-4 text-[15px] font-medium text-success">
          Submitted. A reviewer checks it next.
        </p>
      ) : null}
      <nav aria-label="Lesson status" className="flex flex-wrap gap-2">
        {tabs.map(([k, name]) => {
          const count = k === 'all' ? data.length : data.filter((i) => i.status === k).length;
          const current = k === 'all' ? !filter : filter === k;
          return (
            <Link
              key={k}
              href={k === 'all' ? '/coach/lessons' : `/coach/lessons?status=${k}`}
              aria-current={current ? 'page' : undefined}
              className={`inline-flex min-h-11 items-center gap-2 rounded-pill px-5 text-[15px] font-medium ${current ? 'bg-ink text-paper' : 'border border-line-strong'}`}
            >
              {name} {count}
            </Link>
          );
        })}
      </nav>
      {!data.length ? (
        <div className="flex flex-col items-start gap-3 bg-mist p-8">
          <p className="m-0 text-[18px] font-medium">No lessons yet</p>
          <p className="m-0 text-[16px] text-muted">Your lessons and their review status appear here.</p>
        </div>
      ) : (
        // Stacked cards on a phone, a table-like row on desktop (M-K-Lessons, decision D3).
        <ul aria-label="Lessons" className="m-0 flex list-none flex-col p-0 md:border-t md:border-line">
          {shown.map((i) => {
            const s = statuses[i.status];
            return (
              <li
                key={i.id}
                className="mb-3 flex flex-col gap-2 border border-line p-4 md:mb-0 md:grid md:grid-cols-[minmax(0,3fr)_1fr_1fr_1fr_auto] md:items-center md:gap-4 md:border-0 md:border-b md:px-0 md:py-4"
              >
                <div className="flex flex-col gap-1">
                  <span className="text-[16px] font-medium">{i.title}</span>
                  {i.status === 'needs_changes' && i.review_note ? <span className="text-[14px] text-danger">{i.review_note}</span> : null}
                  {i.video_broken ? <span className="text-[14px] font-medium text-danger">Video broken: YouTube says it is removed or private.{s.action === 'Edit' || i.status === 'needs_changes' ? ' Re-link it.' : ''}</span> : null}
                </div>
                <span className="text-[14px] text-muted">{kinds[i.kind]}</span>
                <span>
                  <Tag variant={s.variant}>{s.label}</Tag>
                </span>
                <span className="text-[14px] text-muted">{day.format(new Date(i.updated_at))}</span>
                <Link href={href(i)} className="inline-flex min-h-11 items-center text-[15px] font-medium underline underline-offset-4">
                  {s.action}
                  <span className="sr-only">: {i.title}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

export default function LessonsPage(props: PageProps<'/coach/lessons'>) {
  return (
    <main className="mx-auto flex w-full max-w-[1200px] flex-col gap-6 px-4 pb-20 pt-8 md:px-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="m-0 font-display text-[48px] font-normal uppercase leading-[0.95] md:text-[64px]">My lessons</h1>
        <Link href="/coach/lessons/new" className={buttonClass()}>
          New lesson
        </Link>
      </div>
      <p className="m-0 text-[15px] text-muted">A second coach reviews every lesson before it goes live. You cannot approve your own.</p>
      <Suspense fallback={null}>
        <Lessons {...props} />
      </Suspense>
    </main>
  );
}
