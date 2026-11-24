import Link from 'next/link';
import { Suspense } from 'react';
import { connection } from 'next/server';
import { db } from '@/lib/db';
import type { LibraryItem } from '@/lib/content';
import { pathOrder, skillStatus } from '@/lib/skill-path';
import { supabaseServer } from '@/lib/supabase/server';
import { getViewer } from '@/lib/viewer';

const labels = { done: 'Done', in_progress: 'In progress', not_started: 'Not started' } as const;

type PathProps = { category: string; categoryName: string; order: string[]; titles: Record<string, string> };

/** The path itself. The guest version (no statuses) and the signed-in version have the same height. */
function PathView({ category, categoryName, order, titles, completed, saved, signedIn }: PathProps & { completed: Set<string>; saved: Set<string>; signedIn: boolean }) {
  const done = order.filter((s) => completed.has(s)).length;
  return (
    <section aria-label="Your skill path" className="mt-8 flex flex-col gap-5 bg-ink p-6 text-paper md:p-8">
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <h2 className="m-0 text-[20px] font-medium">Your path · {categoryName}</h2>
        <span className="text-[14px] text-faint">{signedIn ? `${done} of ${order.length} skills complete` : 'Log in to track your path'}</span>
      </div>
      <ol className="m-0 grid list-none grid-cols-2 gap-x-2 gap-y-4 p-0 sm:grid-cols-4 lg:grid-cols-8">
        {order.map((slug) => {
          const status = skillStatus(slug, completed, saved);
          return (
            <li key={slug}>
              <Link
                href={`/learn/${category}/${slug}`}
                className={`flex flex-col border-t-4 pt-3 ${status === 'done' ? 'border-volt' : status === 'in_progress' ? 'border-paper' : 'border-ink-soft'}`}
              >
                <span className="text-[15px] font-medium">{titles[slug]}</span>
                <span className="text-[13px] text-faint">{labels[status]}</span>
              </Link>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

/** The signed-in person's statuses. It streams in over the guest version, so nothing on the page moves (M6-05). */
async function PathWithStatus(props: PathProps) {
  // The session check reads the clock, so statuses render per request.
  await connection();
  const viewer = await getViewer();
  let completed = new Set<string>();
  let saved = new Set<string>();
  if (viewer) {
    const supabase = await supabaseServer();
    const [c, s] = await Promise.all([
      // RLS already limits rows to the viewer; the filter states it.
      supabase.from('completions').select('content_items!inner(slug)').eq('user_id', viewer.userId),
      supabase.from('saves').select('content_items!inner(slug)').eq('user_id', viewer.userId),
    ]);
    completed = new Set((c.data ?? []).map((r) => r.content_items.slug));
    saved = new Set((s.data ?? []).map((r) => r.content_items.slug));
  }
  return <PathView {...props} completed={completed} saved={saved} signedIn={!!viewer} />;
}

/** The skill path: skills joined by prerequisite links, in order, with the viewer's status on each. */
export async function SkillPath({ category, categoryName, items }: { category: string; categoryName: string; items: LibraryItem[] }) {
  const { data: links } = await db()
    .from('content_links')
    .select('from:content_items!content_links_from_id_fkey(slug), to:content_items!content_links_to_id_fkey(slug)')
    .eq('kind', 'prerequisite');
  const skills = new Map(items.filter((i) => i.kind === 'skill').map((i) => [i.slug, i]));
  const pairs = (links ?? []).flatMap((l) => (l.from && l.to && skills.has(l.from.slug) && skills.has(l.to.slug) ? [[l.from.slug, l.to.slug] as [string, string]] : []));
  const onPath = [...skills.keys()].filter((s) => pairs.some(([a, b]) => a === s || b === s));
  if (onPath.length < 2) return null;
  const props: PathProps = { category, categoryName, order: pathOrder(onPath, pairs), titles: Object.fromEntries([...skills].map(([slug, i]) => [slug, i.title])) };
  return (
    <Suspense fallback={<PathView {...props} completed={new Set()} saved={new Set()} signedIn={false} />}>
      <PathWithStatus {...props} />
    </Suspense>
  );
}
