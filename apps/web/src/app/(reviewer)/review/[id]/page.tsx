import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { authorNames, levelLabel } from '@/lib/content';
import { supabaseServer } from '@/lib/supabase/server';
import { requireRole } from '@/lib/viewer';
import { Video } from '../../../(public)/learn/[category]/[slug]/video';
import { ReviewForm } from './review-form';

export const metadata: Metadata = { title: 'Review · FitSphere' };

async function Review({ params }: PageProps<'/review/[id]'>) {
  const viewer = await requireRole('reviewer');
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  // The viewer's own client: RLS lets a reviewer read items in review.
  const supabase = await supabaseServer();
  const { data: item } = await supabase
    .from('content_items')
    .select('id, title, summary, level, status, video_id, mistakes, safety, supports, author_id, disciplines!inner(name, category_id, categories(name)), content_steps(position, body), content_muscles(is_primary, muscles(name))')
    .eq('id', id)
    .neq('status', 'draft')
    .maybeSingle();
  if (!item) notFound();
  const names = await authorNames([item.author_id], supabase);
  const author = (item.author_id && names.get(item.author_id)) || 'the coach';
  const own = item.author_id === viewer.userId;
  const category = item.disciplines.category_id;

  return (
    <div className="grid gap-10 md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <article className="flex flex-col gap-6">
        {item.video_id ? <Video id={item.video_id} title={item.title} /> : <div className="flex aspect-video items-center justify-center bg-mist text-muted">No video linked</div>}
        <p className="m-0 text-[14px] font-medium text-muted">
          {item.disciplines.categories.name} · {item.disciplines.name} · {levelLabel(category, item.level)} · by {own ? 'you' : author}
        </p>
        <h1 className="m-0 font-display text-[40px] font-normal uppercase leading-[0.95] md:text-[56px]">{item.title}</h1>
        {item.summary ? <p className="m-0 text-[18px]">{item.summary}</p> : null}
        <section className="flex flex-col gap-2">
          <h2 className="m-0 text-[20px] font-medium">Steps</h2>
          <ol className="m-0 flex list-decimal flex-col gap-2 pl-6">
            {[...item.content_steps].sort((a, b) => a.position - b.position).map((s) => (
              <li key={s.position}>{s.body}</li>
            ))}
          </ol>
        </section>
        <section className="flex flex-col gap-2">
          <h2 className="m-0 text-[20px] font-medium">Common mistakes</h2>
          <p className="m-0">{item.mistakes}</p>
        </section>
        <section className="flex flex-col gap-2">
          <h2 className="m-0 text-[20px] font-medium">Safety</h2>
          <p className="m-0">{item.safety}</p>
        </section>
        {item.supports.length || item.content_muscles.length ? (
          <p className="m-0 text-[15px] text-muted">
            {[...item.content_muscles.map((m) => m.muscles.name), ...item.supports.map((s) => s.replace(/_/g, ' '))].join(' · ')}
          </p>
        ) : null}
      </article>
      <aside className="flex flex-col gap-4 self-start border border-line-strong p-5">
        {item.status !== 'in_review' ? (
          <p className="m-0 text-[16px]">This lesson is not waiting for review.</p>
        ) : own ? (
          <p role="note" className="m-0 text-[16px] font-medium">
            You wrote this. Another reviewer approves it.
          </p>
        ) : (
          <ReviewForm itemId={item.id} authorName={author} />
        )}
      </aside>
    </div>
  );
}

export default function ReviewPage(props: PageProps<'/review/[id]'>) {
  return (
    <main className="mx-auto flex w-full max-w-[1200px] flex-col gap-6 px-4 pb-20 pt-8 md:px-10">
      <Link href="/review" className="self-start text-[14px] font-medium underline underline-offset-4">
        Review queue
      </Link>
      <Suspense fallback={null}>
        <Review {...props} />
      </Suspense>
    </main>
  );
}
