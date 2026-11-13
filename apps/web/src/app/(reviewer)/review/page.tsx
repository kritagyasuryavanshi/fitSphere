import type { Metadata } from 'next';
import Link from 'next/link';
import { connection } from 'next/server';
import { Suspense } from 'react';
import { authorNames } from '@/lib/content';
import { supabaseServer } from '@/lib/supabase/server';
import { requireRole } from '@/lib/viewer';

export const metadata: Metadata = { title: 'Review queue · FitSphere' };

const kinds: Record<string, string> = { skill: 'Skill lesson', drill: 'Drill', exercise: 'Exercise' };
const day = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' });
const tabs = [
  { id: 'waiting', label: 'Waiting' },
  { id: 'sent-back', label: 'Sent back' },
  { id: 'published', label: 'Published this week' },
] as const;

async function Queue({ searchParams }: PageProps<'/review'>) {
  const viewer = await requireRole('reviewer');
  const { tab, done } = await searchParams;
  await connection();
  const weekAgo = new Date(Date.now() - 7 * 864e5).toISOString();
  const supabase = await supabaseServer();
  const { data, error } = await supabase
    .from('content_items')
    .select('id, slug, title, kind, status, author_id, updated_at, published_at, disciplines(category_id, categories(name))')
    .in('status', ['in_review', 'needs_changes', 'published'])
    .not('author_id', 'is', null)
    .order('updated_at', { ascending: true });
  if (error) throw error;
  const groups = {
    waiting: data.filter((i) => i.status === 'in_review'),
    'sent-back': data.filter((i) => i.status === 'needs_changes'),
    published: data.filter((i) => i.status === 'published' && i.published_at && i.published_at >= weekAgo),
  };
  const current = tabs.find((t) => t.id === tab)?.id ?? 'waiting';
  const names = await authorNames(data.map((i) => i.author_id), supabase);

  return (
    <>
      {done ? (
        <p role="status" className="m-0 bg-success-soft p-4 text-[15px] font-medium text-success">
          {done === 'published' ? 'Published. It is live in the library now.' : 'Sent back. The coach sees your note.'}
        </p>
      ) : null}
      <nav aria-label="Queue" className="flex flex-wrap gap-2">
        {tabs.map((t) => (
          <Link
            key={t.id}
            href={t.id === 'waiting' ? '/review' : `/review?tab=${t.id}`}
            aria-current={t.id === current ? 'page' : undefined}
            className={`inline-flex min-h-11 items-center gap-2 rounded-pill px-5 text-[15px] font-medium ${t.id === current ? 'bg-ink text-paper' : 'border border-line-strong'}`}
          >
            {t.label} {groups[t.id].length}
          </Link>
        ))}
      </nav>
      {groups[current].length ? (
        <ul aria-label="Lessons to review" className="m-0 flex list-none flex-col border-t border-line p-0">
          {groups[current].map((i) => {
            const own = i.author_id === viewer.userId;
            const by = own ? 'you' : (names.get(i.author_id!) ?? 'a coach');
            const href = i.status === 'published' ? `/learn/${i.disciplines.category_id}/${i.slug}` : `/review/${i.id}`;
            return (
              <li key={i.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-line py-4">
                <div className="flex flex-col gap-1">
                  <span className="text-[16px] font-medium">{i.title}</span>
                  <span className="text-[14px] text-muted">
                    {i.disciplines.categories.name} {kinds[i.kind].toLowerCase()} by {by} · {day.format(new Date(i.updated_at))}
                  </span>
                </div>
                {own && i.status === 'in_review' ? (
                  <span className="text-[14px] text-muted">You wrote this. Another reviewer approves it.</span>
                ) : (
                  <Link href={href} className="inline-flex min-h-11 items-center text-[15px] font-medium underline underline-offset-4">
                    {i.status === 'in_review' ? 'Review' : 'Open'}
                    <span className="sr-only">: {i.title}</span>
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="m-0 bg-mist p-8 text-[16px] text-muted">Nothing here right now.</p>
      )}
    </>
  );
}

export default function QueuePage(props: PageProps<'/review'>) {
  return (
    <main className="mx-auto flex w-full max-w-[1200px] flex-col gap-6 px-4 pb-20 pt-8 md:px-10">
      <h1 className="m-0 font-display text-[48px] font-normal uppercase leading-[0.95] md:text-[64px]">Review queue</h1>
      <p className="m-0 text-[15px] text-muted">Check technique, safety and the video. Only published lessons reach athletes and the AI guide.</p>
      <Suspense fallback={null}>
        <Queue {...props} />
      </Suspense>
    </main>
  );
}
