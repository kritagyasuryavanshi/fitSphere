import { Tag } from '@fitsphere/ui';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense, type ReactNode } from 'react';
import { humanise, lessonBySlug, levelLabel } from '@/lib/content';
import { Video } from './video';

export async function generateMetadata({ params }: PageProps<'/learn/[category]/[slug]'>): Promise<Metadata> {
  const { category, slug } = await params;
  const item = await lessonBySlug(category, slug);
  return { title: item ? `${item.title} · FitSphere` : 'Not found · FitSphere' };
}

const goals: Record<string, string> = { build_muscle: 'Build muscle', get_stronger: 'Get stronger', lose_fat: 'Lose fat', get_fitter: 'Get fitter' };

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3 border-t border-line pt-6">
      <h2 className="m-0 text-[20px] font-medium">{title}</h2>
      {children}
    </section>
  );
}

function ItemLinks({ items }: { items: { slug: string; title: string; level: string; category: string; isSample: boolean }[] }) {
  return (
    <ul className="m-0 flex list-none flex-col p-0">
      {items.map((i) => (
        <li key={i.slug} className="border-b border-line last:border-0">
          <Link href={`/learn/${i.category}/${i.slug}`} className="flex min-h-14 items-center justify-between gap-4 py-2">
            <span className="text-[16px] font-medium">{i.title}</span>
            <span className="text-[14px] text-muted">
              {levelLabel(i.category, i.level)}
              {i.isSample ? ' · Sample' : ''}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

async function Lesson({ params }: PageProps<'/learn/[category]/[slug]'>) {
  const { category, slug } = await params;
  const item = await lessonBySlug(category, slug);
  if (!item) notFound();
  const meta = [levelLabel(category, item.level), item.durationMin ? `${item.durationMin} min` : null, item.equipment.length ? item.equipment.map(humanise).join(', ') : 'No equipment']
    .filter(Boolean)
    .join(' · ');
  const repTable = item.dose.filter((d) => d.goal);
  const typical = item.dose.filter((d) => d.value);

  return (
    <main className="mx-auto w-full max-w-[1200px] px-4 pb-20 pt-8 md:px-10">
      <nav aria-label="Breadcrumb" className="text-[14px] font-medium text-muted">
        <Link href={`/learn/${category}`} className="underline underline-offset-4">
          {item.categoryName}
        </Link>{' '}
        · {item.discipline}
      </nav>

      <div className="mt-6 grid gap-10 md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="flex flex-col gap-6">
          {item.videoId ? (
            <Video id={item.videoId} title={item.title} />
          ) : (
            <div className="flex aspect-video w-full items-center justify-center bg-mist p-6 text-center text-[16px] text-muted">The video comes when a coach films this lesson.</div>
          )}
        </div>

        <div className="flex flex-col gap-4">
          <h1 className="m-0 font-display text-[48px] font-normal uppercase leading-[0.95] md:text-[64px]">{item.title}</h1>
          <p className="m-0 text-[16px] text-muted">{meta}</p>
          <div className="flex flex-wrap gap-2">
            {item.isSample ? <Tag variant="warning">Sample, awaiting a coach</Tag> : <Tag variant="success">Coach-verified</Tag>}
            {item.muscles.map((m) => (
              <Tag key={m}>{m}</Tag>
            ))}
            {item.supports.map((s) => (
              <Tag key={s}>Builds {humanise(s).toLowerCase()}</Tag>
            ))}
          </div>
          {item.summary ? <p className="m-0 text-[18px] leading-[1.5]">{item.summary}</p> : null}
          {item.author ? (
            <p className="m-0 text-[15px]">
              Taught by <span className="font-medium">{item.author}</span>
              {item.reviewer ? <span className="text-muted"> · Reviewed by {item.reviewer}</span> : null}
            </p>
          ) : (
            <p className="m-0 text-[15px] text-muted">Sample items are placeholders until a coach replaces them. The AI guide never cites them.</p>
          )}
          {typical.map((d) => (
            <div key={d.value} className="bg-mist p-5">
              <p className="m-0 text-[14px] font-medium text-muted">{d.label}</p>
              <p className="m-0 font-display text-[32px] uppercase">{d.value}</p>
              <p className="m-0 text-[14px] text-muted">{d.note} Your coach sets your own dose.</p>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-12 flex max-w-[760px] flex-col gap-8">
        <Block title="Step by step">
          <ol className="m-0 flex list-decimal flex-col gap-3 pl-6 text-[16px] leading-[1.5]">
            {item.steps.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ol>
        </Block>
        <Block title="Common mistakes">
          <p className="m-0 text-[16px] leading-[1.5]">{item.mistakes}</p>
        </Block>
        <Block title="Safety">
          <p className="m-0 text-[16px] leading-[1.5]">{item.safety}</p>
        </Block>
        {repTable.length ? (
          <Block title="How to dose it for your goal">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] border-collapse text-left text-[15px]">
                <thead>
                  <tr className="border-b border-line-strong">
                    {['Goal', 'Reps', 'Sets', 'Rest', 'How hard'].map((h) => (
                      <th key={h} scope="col" className="py-2 pr-4 font-medium">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {repTable.map((d) => (
                    <tr key={d.goal} className="border-b border-line">
                      <th scope="row" className="py-3 pr-4 font-medium">
                        {goals[d.goal!] ?? humanise(d.goal!)}
                      </th>
                      <td className="py-3 pr-4">{d.reps}</td>
                      <td className="py-3 pr-4">{d.sets}</td>
                      <td className="py-3 pr-4">{d.rest}</td>
                      <td className="py-3 pr-4">{d.effort}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="m-0 text-[14px] text-muted">General guidance from the lesson. Your coach&apos;s program sets your exact dose.</p>
          </Block>
        ) : null}
        {item.prerequisites.length ? (
          <Block title="Learn this first">
            <ItemLinks items={item.prerequisites} />
          </Block>
        ) : null}
        {item.next.length ? (
          <Block title="Practise it next">
            <ItemLinks items={item.next} />
          </Block>
        ) : null}
        {item.related.length ? (
          <Block title={category === 'gym' ? 'No kit free? Try these' : 'Related'}>
            <ItemLinks items={item.related} />
          </Block>
        ) : null}
      </div>
    </main>
  );
}

export default function LessonPage(props: PageProps<'/learn/[category]/[slug]'>) {
  return (
    <Suspense fallback={<main className="mx-auto min-h-[60vh] w-full max-w-[1200px]" />}>
      <Lesson {...props} />
    </Suspense>
  );
}
