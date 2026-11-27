import { buttonClass } from '@fitsphere/ui';
import Image from 'next/image';
import Link from 'next/link';
import { connection } from 'next/server';
import { Suspense } from 'react';
import { OfferCarousel, type Slide } from '@/components/offer-carousel';
import { SportPaths } from '@/components/sport-paths';
import { humanise, libraryItems, type LibraryItem } from '@/lib/content';
import { db } from '@/lib/db';

// C-Landing (M6-01). Every lesson, coach and count comes from the database: nothing is invented. A section with
// nothing to show is left out. Ask AI and hiring are closed in the beta (M6-10), so the page does not offer them.
// Multi-sport (decision-multi-sport): no sport is the front door. The hero shows what is live today, and a sport that
// is not live (cricket) is named only as planned.

const slides: Slide[] = [
  {
    eyebrow: 'Boxing',
    title: 'Learn boxing step by step.',
    text: 'Stance, punches, footwork and defence on a skill path. A second coach checks every lesson.',
    href: '/learn/boxing',
    cta: 'Boxing lessons',
    photo: { src: '/images/heavybag.jpg', alt: '' },
  },
  {
    eyebrow: 'Strength & conditioning',
    title: 'Strength and fitness for any sport.',
    text: 'Strength, power, speed and conditioning work. Train it on its own or next to your sport.',
    href: '/learn/sc',
    cta: 'S&C exercises',
    photo: { src: '/images/squat-bw.jpg', alt: '' },
  },
  {
    eyebrow: 'Gym & hypertrophy',
    title: 'Build muscle with a plan.',
    text: 'Log every set, see last time’s numbers, and get the next weight to lift.',
    href: '/learn/gym',
    cta: 'Gym exercises',
    panel: { word: 'Sets × reps', tone: 'volt' },
  },
  {
    eyebrow: 'Coach-built programs',
    title: 'Your coach’s plan, in one Today view.',
    text: 'Join with an invite link. Sessions from every program land on one schedule, and your coach reads your log.',
    href: '/programs',
    cta: 'How programs work',
    panel: { word: 'Week 1 · Day 1', tone: 'ink' },
  },
  {
    eyebrow: 'Progress & feedback',
    title: 'See your bests and your coach’s notes.',
    text: 'Personal records, sessions done, sets per muscle and body weight, with feedback on your sessions.',
    href: '/sign-in',
    cta: 'Start training free',
    panel: { word: 'New best', tone: 'ink' },
  },
  {
    eyebrow: 'Coaches',
    title: 'Find a coach who fits.',
    text: 'Profiles show specialties, experience and which credentials we checked.',
    href: '/coaches',
    cta: 'Meet the coaches',
    panel: { word: 'Coaches', tone: 'volt' },
  },
];

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
  const [boxing, sc, gym, coaches, categories] = await Promise.all([
    libraryItems('boxing'),
    libraryItems('sc'),
    libraryItems('gym'),
    db().rpc('find_coaches', {}),
    db().from('categories').select('id, name, tagline, is_live').order('sort'),
  ]);
  if (coaches.error) throw coaches.error;
  if (categories.error) throw categories.error;
  const liveCoaches = coaches.data.slice(0, 3);
  const live = categories.data.filter((c) => c.is_live);
  const loaded: Record<string, number> = { boxing: boxing.length, sc: sc.length, gym: gym.length };
  // A sport added later gets its real count too.
  const counts = Object.fromEntries(await Promise.all(live.map(async (c) => [c.id, loaded[c.id] ?? (await libraryItems(c.id)).length] as const)));
  return (
    <>
      <section aria-labelledby="paths" className={`${wrap} flex flex-col gap-6 py-14`}>
        <h2 id="paths" className={h2}>
          Pick your path
        </h2>
        <SportPaths
          paths={live.map((c) => ({ id: c.id, name: c.name, tagline: c.tagline, count: counts[c.id] ?? 0 }))}
          planned={categories.data.filter((c) => !c.is_live).map((c) => c.name)}
        />
      </section>

      {boxing.length ? (
        <section aria-labelledby="fundamentals" className={`${wrap} flex flex-col gap-6 py-14`}>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <h2 id="fundamentals" className={h2}>
              Boxing fundamentals
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
                Strength for any sport.
              </h2>
              <p className="m-0 text-[18px] leading-[1.5] text-mist">Strength, power and conditioning you can train on its own, for the gym, or next to a sport. Each exercise names what it builds.</p>
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
                See all {sc.length} S&amp;C exercises
              </Link>
            </div>
          </div>
        </section>
      ) : null}

      {gym.length ? (
        <section aria-labelledby="gym" className={`${wrap} flex flex-col gap-6 py-14`}>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <h2 id="gym" className={h2}>
              Build muscle in the gym.
            </h2>
            <Link href="/learn/gym" className={more}>
              All {gym.length} gym exercises
            </Link>
          </div>
          <p className="m-0 max-w-[640px] text-[18px] leading-[1.5] text-ink-soft">Hypertrophy, strength and fat loss. Follow your coach’s program, see last week’s numbers, and beat them.</p>
          <LessonCards category="gym" items={gym.slice(0, 4)} />
        </section>
      ) : null}

      <section aria-label="How FitSphere works" className="bg-mist">
        <div className={`${wrap} grid gap-8 py-14 md:grid-cols-3`}>
          {(
            [
              ['Learn', 'Video lessons for every skill, with steps, mistakes and safety. A second coach checks each one before it goes live.', '/learn', 'Browse lessons'],
              ['Train', 'Your coach’s program in one Today view, whatever you train, and a log your coach reads.', '/programs', 'How training works'],
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
      <OfferCarousel slides={slides}>
        <div className="flex flex-col gap-5">
          <h1 className="m-0 max-w-[1000px] font-display text-[56px] font-normal uppercase leading-[0.9] md:text-[clamp(72px,8vw,128px)]">Learn it. Train it. Get stronger.</h1>
          <p className="m-0 max-w-[600px] text-[18px] leading-[1.5] text-mist">Boxing, strength and conditioning, and gym training, with coach-built plans and a log your coach reads.</p>
          <div className="flex flex-wrap gap-3">
            <Link href="/sign-in" className={buttonClass({ variant: 'volt' })}>
              Start training free
            </Link>
            <Link href="/learn" className={buttonClass({ variant: 'ghost' })}>
              Explore lessons
            </Link>
          </div>
        </div>
      </OfferCarousel>
      <Suspense fallback={<div className="min-h-[400px]" />}>
        <Sections />
      </Suspense>
    </main>
  );
}
