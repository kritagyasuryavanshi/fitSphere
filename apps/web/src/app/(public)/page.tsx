import { buttonClass } from '@fitsphere/ui';
import Image from 'next/image';
import Link from 'next/link';
import { connection } from 'next/server';
import { Suspense } from 'react';
import { humanise, libraryItems, type LibraryItem } from '@/lib/content';
import { db } from '@/lib/db';

// C-Landing (M6-01). Every lesson, coach and count comes from the database: nothing is invented. A section with
// nothing to show is left out. Ask AI and hiring are closed in the beta (M6-10), so the page does not offer them.

// The account delete action lands here with ?deleted=1, so the person sees that it worked.
async function DeletedNotice({ searchParams }: { searchParams: PageProps<'/'>['searchParams'] }) {
  const { deleted } = await searchParams;
  return deleted === '1' ? (
    <p role="status" className="mx-auto mt-4 w-full max-w-[1440px] border-l-4 border-success bg-success-soft px-4 py-3 text-[15px] font-medium md:px-10">
      Your account and everything personal in it have been deleted.
    </p>
  ) : null;
}

const wrap = 'mx-auto w-full max-w-[1440px] px-4 md:px-10';
const h2 = 'm-0 font-display text-[40px] font-normal uppercase leading-[0.95] md:text-[56px]';
const more = 'text-[16px] font-medium underline underline-offset-4';

function LessonCards({ category, items, tag }: { category: string; items: LibraryItem[]; tag?: (i: LibraryItem) => string | undefined }) {
  return (
    <ul className="m-0 grid list-none gap-4 p-0 sm:grid-cols-2 lg:grid-cols-4">
      {items.map((i) => (
        <li key={i.slug}>
          <Link href={`/learn/${category}/${i.slug}`} className="flex h-full flex-col gap-2 border border-line-strong p-5 hover:border-ink">
            <span className="text-[13px] font-medium uppercase tracking-wide text-muted">{humanise(i.discipline)}</span>
            <span className="text-[20px] font-semibold leading-tight">{i.title}</span>
            <span className="mt-auto text-[14px] text-ink-soft">
              {[humanise(i.level), i.durationMin ? `${i.durationMin} min` : null, i.isSample ? 'Sample' : i.authorName].filter(Boolean).join(' · ')}
            </span>
            {tag?.(i) ? <span className="self-start bg-volt px-2 py-0.5 text-[13px] font-medium">{tag(i)}</span> : null}
          </Link>
        </li>
      ))}
    </ul>
  );
}

async function Sections() {
  // Live data: read at request time, never at build time.
  await connection();
  const [boxing, sc, gym, coaches] = await Promise.all([
    libraryItems('boxing'),
    libraryItems('sc'),
    libraryItems('gym'),
    db().rpc('find_coaches', {}),
  ]);
  if (coaches.error) throw coaches.error;
  const liveCoaches = coaches.data.slice(0, 3);
  return (
    <>
      {boxing.length ? (
        <section aria-labelledby="fundamentals" className={`${wrap} flex flex-col gap-6 py-14`}>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <h2 id="fundamentals" className={h2}>
              Learn the fundamentals
            </h2>
            <Link href="/learn/boxing" className={more}>
              All {boxing.length} boxing lessons
            </Link>
          </div>
          <LessonCards category="boxing" items={boxing.slice(0, 4)} />
        </section>
      ) : null}

      {sc.length ? (
        <section aria-labelledby="strength" className="bg-ink text-paper">
          <div className={`${wrap} grid gap-8 py-14 md:grid-cols-2`}>
            <div className="relative min-h-[320px] overflow-hidden">
              <Image src="/images/squat-bw.jpg" alt="An athlete holding a deep barbell squat" fill sizes="(min-width: 768px) 50vw, 100vw" className="object-cover" />
            </div>
            <div className="flex flex-col gap-5">
              <h2 id="strength" className={h2}>
                Strength for the ring.
              </h2>
              <p className="m-0 text-[18px] leading-[1.5] text-mist">Each strength and conditioning exercise names the boxing skill it builds. One plan for both sides of your training.</p>
              <ul className="m-0 flex list-none flex-col p-0">
                {sc.slice(0, 4).map((i) => (
                  <li key={i.slug} className="border-t border-ink-soft">
                    <Link href={`/learn/sc/${i.slug}`} className="flex items-center justify-between gap-4 py-3 text-paper hover:text-volt">
                      <span className="flex flex-col">
                        <span className="text-[17px] font-medium">{i.title}</span>
                        <span className="text-[14px] text-line-strong">{[humanise(i.level), i.equipment.map(humanise).join(', ') || 'No equipment'].join(' · ')}</span>
                      </span>
                      {i.supports[0] ? <span className="flex-none bg-volt px-2 py-0.5 text-[13px] font-medium text-ink">{humanise(i.supports[0])}</span> : null}
                    </Link>
                  </li>
                ))}
              </ul>
              <Link href="/learn/sc" className={`${buttonClass({ variant: 'volt' })} self-start`}>
                See all {sc.length} S&amp;C lessons
              </Link>
            </div>
          </div>
        </section>
      ) : null}

      {gym.length ? (
        <section aria-labelledby="gym" className={`${wrap} flex flex-col gap-6 py-14`}>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <h2 id="gym" className={h2}>
              The gym, done properly.
            </h2>
            <Link href="/learn/gym" className={more}>
              All {gym.length} gym exercises
            </Link>
          </div>
          <p className="m-0 max-w-[640px] text-[18px] leading-[1.5] text-ink-soft">Follow your coach’s program, see last week’s numbers, and beat them.</p>
          <LessonCards category="gym" items={gym.slice(0, 4)} />
        </section>
      ) : null}

      <section aria-label="How FitSphere works" className="bg-mist">
        <div className={`${wrap} grid gap-8 py-14 md:grid-cols-3`}>
          {(
            [
              ['Learn', 'Video lessons for every skill, with steps, mistakes and safety. A second coach checks each one before it goes live.', '/learn/boxing', 'Browse lessons'],
              ['Train', 'Your coach’s program in one Today view, boxing and strength together, and a log your coach reads.', '/programs', 'How training works'],
              ['Get coached', 'Coaches build your program, read your logs and send feedback on your sessions.', '/coaches', 'Meet the coaches'],
            ] as const
          ).map(([title, text, href, cta]) => (
            <div key={title} className="flex flex-col items-start gap-3">
              <h3 className="m-0 font-display text-[32px] font-normal uppercase leading-none">{title}</h3>
              <p className="m-0 text-[16px] leading-[1.6] text-ink-soft">{text}</p>
              <Link href={href} className={more}>
                {cta}
              </Link>
            </div>
          ))}
        </div>
      </section>

      {liveCoaches.length ? (
        <section aria-labelledby="coaches" className={`${wrap} flex flex-col gap-6 py-14`}>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <h2 id="coaches" className={h2}>
              Built with real coaches.
            </h2>
            <Link href="/for-coaches" className={more}>
              Coach with FitSphere
            </Link>
          </div>
          <ul className="m-0 grid list-none gap-4 p-0 md:grid-cols-3">
            {liveCoaches.map((c) => (
              <li key={c.coach_id}>
                <Link href={`/coaches/${c.coach_id}`} className="flex h-full flex-col gap-1 border border-line-strong p-5 hover:border-ink">
                  <span className="text-[20px] font-semibold">{c.name}</span>
                  <span className="text-[14px] text-ink-soft">{[c.specialties.join(', '), c.coach_city, c.years ? `${c.years} years coaching` : null].filter(Boolean).join(' · ')}</span>
                  {c.headline ? <span className="mt-2 text-[15px]">{c.headline}</span> : null}
                </Link>
              </li>
            ))}
          </ul>
          <p className="m-0 text-[14px] text-muted">Years of experience are self-reported. Checked credentials show on each profile.</p>
        </section>
      ) : null}
    </>
  );
}

export default function Home({ searchParams }: PageProps<'/'>) {
  return (
    <main>
      <Suspense fallback={null}>
        <DeletedNotice searchParams={searchParams} />
      </Suspense>
      <section className="relative flex min-h-[560px] items-end overflow-hidden bg-ink text-paper md:min-h-[720px]">
        <Image src="/images/heavybag.jpg" alt="A heavy bag hanging in a boxing gym" fill priority sizes="100vw" className="object-cover opacity-60" />
        <div className={`${wrap} relative flex flex-col gap-6 pb-14 md:pb-20`}>
          <h1 className="m-0 max-w-[1000px] font-display text-[64px] font-normal uppercase leading-[0.9] md:text-[clamp(72px,9vw,140px)]">Every round starts with the jab.</h1>
          <p className="m-0 max-w-[560px] text-[18px] leading-[1.5] text-mist">Coach-taught boxing, strength and gym training, in one plan.</p>
          <div className="flex flex-wrap gap-3">
            <Link href="/sign-in" className={buttonClass({ variant: 'volt' })}>
              Start training free
            </Link>
            <Link href="/learn/boxing" className={buttonClass({ variant: 'ghost' })}>
              Explore lessons
            </Link>
          </div>
        </div>
      </section>
      <Suspense fallback={<div className="min-h-[400px]" />}>
        <Sections />
      </Suspense>
    </main>
  );
}
