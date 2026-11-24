import { Tag } from '@fitsphere/ui';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { connection } from 'next/server';
import { Suspense } from 'react';
import { formatInr } from '@fitsphere/core';
import { isUuid } from '@/lib/programs';
import { supabaseServer } from '@/lib/supabase/server';
import { buttonClass } from '@fitsphere/ui';
import { getViewer } from '@/lib/viewer';
import { ShortlistButton } from '../shortlist-button';
import { ReportForm } from '@/components/report-form';
import { ReportNotice } from '@/components/report-notice';

// Each coach page names its coach, for tabs, search results and link previews.
export async function generateMetadata({ params }: PageProps<'/coaches/[id]'>): Promise<Metadata> {
  const { id } = await params;
  if (!isUuid(id)) return { title: 'Coach · FitSphere' };
  // The cookie client checks token expiry with Date.now(), which a prerender refuses, so render at request time.
  await connection();
  const supabase = await supabaseServer();
  const [name, profile] = await Promise.all([
    supabase.rpc('coach_public_name', { coach: id }),
    supabase.from('coach_profiles').select('headline').eq('coach_id', id).maybeSingle(),
  ]);
  if (!name.data) return { title: 'Coach · FitSphere' };
  return { title: `${name.data} · Coach on FitSphere`, description: profile.data?.headline || undefined };
}

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const paidFor = (kind: string, n: number) => (kind === 'single' ? 'a session' : `${n} ${n === 1 ? 'month' : 'months'}`);

// P-Coach (first version, M4-02): a live coach's public profile. RLS returns only live coaches, their live packages and
// slots, and checked credentials. Stats come from a definer function over FitSphere records (M4-05). Programs are
// private (invite only); the portfolio lists only those the coach chose to show (M4-05b).
// Reviews are verified (M4-14): only clients with a finished paid period, shown with first name and last initial.
async function Coach({ params }: PageProps<'/coaches/[id]'>) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const supabase = await supabaseServer();
  const viewer = await getViewer();
  const [profile, name, packages, slots, credentials, stats, lessons, mine, room, programs, reviews, rating, market, open, stories] = await Promise.all([
    supabase.from('coach_profiles').select('headline, philosophy, specialties, languages, formats, city, years').eq('coach_id', id).maybeSingle(),
    supabase.rpc('coach_public_name', { coach: id }),
    supabase.from('packages').select('id, title, kind, price_paise, minutes').eq('coach_id', id).eq('live', true).order('price_paise'),
    supabase.from('availability_slots').select('dow, start_time, minutes').eq('coach_id', id).order('dow').order('start_time'),
    supabase.from('public_credentials').select('id, title, issuer').eq('coach_id', id),
    supabase.rpc('coach_stats', { coach: id }).maybeSingle(),
    supabase.from('content_items').select('slug, title, disciplines!inner(category_id)').eq('author_id', id).eq('status', 'published').eq('is_sample', false).order('title').limit(6),
    viewer ? supabase.from('shortlists').select('coach_id').eq('coach_id', id) : Promise.resolve({ data: [], error: null }),
    supabase.rpc('coach_has_room', { coach: id }),
    supabase.rpc('coach_programs', { coach: id }),
    supabase.rpc('coach_reviews', { coach: id }),
    supabase.rpc('coach_rating', { coach: id }).maybeSingle(),
    supabase.rpc('marketplace_open'),
    viewer
      ? supabase.from('engagements').select('id').eq('athlete_id', viewer.userId).eq('coach_id', id).in('status', ['requested', 'accepted', 'active', 'cancelling'])
      : Promise.resolve({ data: [], error: null }),
    supabase.rpc('public_stories', { coach: id }),
  ]);
  for (const r of [profile, name, packages, slots, credentials, stats, lessons, mine, room, programs, reviews, rating, market, open, stories]) if (r.error) throw r.error;
  const st = stats.data;
  const statRows: [string, string][] = st
    ? [
        ['Athletes coached', String(st.athletes)],
        ['Programs finished', String(st.programs_finished)],
        ['Clients who stayed 3+ months', st.stayed_pct === null ? 'Not enough clients yet' : `${st.stayed_pct}%`],
        ['Average adherence', st.adherence_pct === null ? 'Not enough clients yet' : `${st.adherence_pct}%`],
      ]
    : [];
  const p = profile.data;
  if (!p || !name.data) notFound();
  const listed = (mine.data ?? []).length === 1;
  const initials = name.data
    .replace(/\(.*?\)/g, '')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
  const formats = p.formats.map((f) => (f === 'in_person' ? 'in person' : 'online'));
  const tagline = [p.city, formats.length ? formats.join(' and ').replace(/^./, (c) => c.toUpperCase()) : ''].filter(Boolean).join(' · ');
  const checked = credentials.data!.length > 0;
  const featured = packages.data!.find((k) => k.kind === 'monthly')?.id;
  const byDay = DAYS.map((d, i) => [d, slots.data!.filter((s) => s.dow === i + 1)] as const).filter(([, s]) => s.length);
  const h2Big = 'm-0 font-display text-[40px] font-normal uppercase leading-[0.9] md:text-[56px]';
  const h2Small = 'm-0 text-[24px] font-medium tracking-[-0.01em]';

  return (
    <>
      <Link href="/coaches" className="inline-flex min-h-11 items-center gap-1.5 self-start text-[15px] font-medium">
        <span aria-hidden="true">←</span> All coaches
      </Link>

      {/* P-Coach hero. No photo field exists yet, so the coach's initials stand in; a stock photo would suggest a real face. */}
      <div className="mt-4 flex flex-col gap-8 md:flex-row md:items-end md:gap-12">
        <div aria-hidden="true" className="flex aspect-square w-40 flex-none items-center justify-center bg-ink font-display text-[72px] uppercase leading-none text-volt md:w-[280px] md:text-[128px]">
          {initials}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <span className={`inline-flex items-center gap-1 text-[12px] font-semibold ${checked ? 'text-success' : 'text-muted'}`}>
            {checked ? '✓ Credentials checked' : 'Credentials self-reported'}
          </span>
          <h1 className="m-0 break-words font-display text-[56px] font-normal uppercase leading-[0.9] md:text-[clamp(64px,8vw,120px)]">{name.data}</h1>
          <p className="m-0 text-[18px] font-medium">{[p.headline, tagline].filter(Boolean).join(' · ')}</p>
          {rating.data?.rating ? (
            <span className="text-[14px] font-semibold">
              ★ {Number(rating.data.rating).toFixed(1)} <span className="font-normal text-muted">({rating.data.review_count} verified {rating.data.review_count === 1 ? 'review' : 'reviews'})</span>
            </span>
          ) : (
            <span className="text-[14px] text-muted">No reviews yet</span>
          )}
          <div className="flex flex-wrap gap-2">
            {[...p.specialties, ...(p.languages.length ? [p.languages.join(', ')] : [])].map((s) => (
              <Tag key={s} variant="outline">
                {s}
              </Tag>
            ))}
          </div>
          {viewer?.userId === id ? null : (
            <div className="flex flex-wrap items-center gap-2">
              {(open.data ?? []).length ? (
                <Link href="/coaching" className={buttonClass()}>
                  View your coaching
                </Link>
              ) : !market.data ? (
                <span className="inline-flex min-h-12 items-center rounded-pill bg-mist px-7 text-[16px] font-medium text-ink-soft">Hiring opens soon</span>
              ) : room.data ? (
                <Link href={viewer ? `/hire/${id}` : '/sign-in'} className={buttonClass()}>
                  Hire {name.data}
                </Link>
              ) : (
                <span className="inline-flex min-h-12 items-center rounded-pill bg-mist px-7 text-[16px] font-medium text-ink-soft">Not taking new clients</span>
              )}
              <ShortlistButton coachId={id} on={listed} signedIn={!!viewer} name={name.data} />
            </div>
          )}
          {p.years ? <p className="m-0 text-[13px] text-muted">{p.years} years coaching, self-reported.</p> : null}
        </div>
      </div>

      {statRows.length ? (
        <section aria-labelledby="stats" className="mt-16">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h2 id="stats" className={h2Small}>
              On FitSphere
            </h2>
            <span className="text-[13px] text-muted">From FitSphere records, not entered by the coach</span>
          </div>
          <dl className="m-0 mt-3 grid grid-cols-2 border-t-2 border-ink md:grid-cols-4">
            {statRows.map(([label, value]) => (
              <div key={label} className="flex flex-col py-5 pr-5">
                <dt className="text-[14px] text-muted">{label}</dt>
                <dd className={`m-0 mt-1.5 ${/^\d/.test(value) ? 'font-display text-[56px] leading-[0.9] md:text-[64px]' : 'text-[16px] font-medium text-ink-soft'}`}>{value}</dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}

      {packages.data!.length ? (
        <section aria-labelledby="packages" className="mt-16">
          <h2 id="packages" className={h2Big}>
            Packages
          </h2>
          <div className="mt-5 grid gap-2 md:grid-cols-[repeat(auto-fit,minmax(260px,1fr))]">
            {packages.data!.map((k) => {
              const dark = k.id === featured;
              return (
                <article key={k.id} className={`flex min-w-0 flex-col gap-3 p-7 ${dark ? 'bg-ink text-paper' : 'bg-mist'}`}>
                  {dark ? <span className="self-start rounded-pill bg-volt px-3 py-1.5 text-[12px] font-semibold text-ink">Ongoing coaching</span> : <span className="h-[30px]" />}
                  <h3 className="m-0 text-[20px] font-semibold">{k.title}</h3>
                  <p className="m-0">
                    <span className="font-display text-[48px] leading-none">{formatInr(k.price_paise)}</span> <span className="text-[15px]">{k.kind === 'monthly' ? 'per month' : 'per session'}</span>
                  </p>
                  <ul className={`m-0 list-none border-t p-0 pt-3 text-[15px] ${dark ? 'border-ink-soft' : 'border-line-strong'}`}>
                    {(k.kind === 'monthly'
                      ? ['A program built for you, updated as you progress', 'Feedback on your logged sessions', 'Cancel any time; the paid month runs to its end']
                      : [`${k.minutes ?? 60}-minute session at a time you book`, 'Booked at least 48 hours ahead', 'Refundable up to 24 hours before']
                    ).map((f) => (
                      <li key={f} className="flex gap-2 py-1.5">
                        <span aria-hidden="true" className={dark ? 'text-volt' : 'text-success'}>
                          ✓
                        </span>
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                </article>
              );
            })}
          </div>
          <p className="m-0 mt-3 text-[13px] text-muted">Prices set by the coach. Paid through FitSphere.</p>
        </section>
      ) : null}

      <div className="mt-16 flex flex-col gap-12 md:flex-row md:items-start">
        <section aria-labelledby="cred" className="min-w-0 flex-1">
          <h2 id="cred" className={h2Small}>
            Experience and credentials
          </h2>
          <ul className="m-0 mt-3 list-none border-t border-line-strong p-0">
            {credentials.data!.map((c) => (
              <li key={c.id} className="flex justify-between gap-3 border-b border-line-strong py-3.5 text-[15px]">
                <span>
                  {c.title}
                  {c.issuer ? <span className="text-muted">, {c.issuer}</span> : null}
                </span>
                <span className="flex-none text-[12px] font-semibold text-success">✓ Checked</span>
              </li>
            ))}
            {p.years ? (
              <li className="flex justify-between gap-3 border-b border-line-strong py-3.5 text-[15px]">
                <span>{p.years} years coaching</span>
                <span className="flex-none text-[12px] font-medium text-muted">Self-reported</span>
              </li>
            ) : null}
            {!checked && !p.years ? <li className="py-3.5 text-[15px] text-muted">No credentials added yet.</li> : null}
          </ul>
        </section>
        <section aria-labelledby="how" className="flex min-w-0 flex-1 flex-col gap-3">
          <h2 id="how" className={h2Small}>
            How I coach
          </h2>
          {p.philosophy ? (
            <blockquote className="m-0 whitespace-pre-line border-t-2 border-ink pt-4 text-[18px] font-medium leading-[1.5] md:text-[20px]">{p.philosophy}</blockquote>
          ) : (
            <p className="m-0 border-t-2 border-ink pt-4 text-[16px] text-muted">This coach has not written about their approach yet.</p>
          )}
          {byDay.length ? (
            <>
              <h3 className="m-0 mt-4 text-[16px] font-semibold">Weekly 1:1 hours (India time)</h3>
              <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4">
                {byDay.map(([d, list]) => (
                  <div key={d} className="flex min-h-16 flex-col items-center justify-center gap-0.5 border border-line-strong px-2 py-2 text-center text-[14px]">
                    <span className="font-semibold">{d}</span>
                    {list.map((s) => (
                      <span key={s.start_time} className="text-ink-soft">
                        {s.start_time.slice(0, 5)}
                      </span>
                    ))}
                  </div>
                ))}
              </div>
            </>
          ) : null}
        </section>
      </div>

      {lessons.data!.length || programs.data!.length || stories.data?.length ? (
        <section aria-labelledby="portfolio" className="mt-16">
          <h2 id="portfolio" className={h2Big}>
            Portfolio
          </h2>
          <div className="mt-5 grid gap-2 md:grid-cols-[repeat(auto-fit,minmax(280px,1fr))]">
            {lessons.data!.map((l) => (
              <Link key={l.slug} href={`/learn/${l.disciplines.category_id}/${l.slug}`} className="flex flex-col gap-1.5 border border-line-strong p-6 hover:border-ink">
                <span className="text-[13px] font-medium uppercase tracking-wide text-muted">Lesson</span>
                <span className="text-[18px] font-semibold">{l.title}</span>
                <span className="text-[14px] text-muted">Coach-verified lesson on FitSphere</span>
              </Link>
            ))}
            {programs.data!.map((g) => (
              <div key={g.program_id} className="flex flex-col gap-1.5 bg-ink p-6 text-paper">
                <span className="text-[13px] font-medium uppercase tracking-wide text-volt">Program</span>
                <span className="text-[18px] font-semibold">{g.title}</span>
                <span className="text-[14px] text-line-strong">
                  {g.weeks} {g.weeks === 1 ? 'week' : 'weeks'}
                  {g.enrolled_band ? ` · ${g.enrolled_band}+ athletes enrolled` : ''}
                </span>
              </div>
            ))}
            {stories.data?.map((st) => (
              <div key={st.id} className="flex flex-col gap-2.5 bg-mist p-6">
                <span className="text-[16px] font-semibold">Client story: {st.author}</span>
                <p className="m-0 text-[15px] leading-[1.55] text-ink-soft">{st.body}</p>
                {st.photo_count ? (
                  <div className="flex flex-wrap gap-2">
                    {Array.from({ length: st.photo_count }, (_, n) => (
                      // eslint-disable-next-line @next/next/no-img-element -- served through a short-lived signed link
                      <img key={n} src={`/api/stories/${st.id}/photo/${n}`} alt={`Photo ${n + 1} from ${st.author}'s story`} className="h-28 w-28 object-cover" loading="lazy" />
                    ))}
                  </div>
                ) : null}
                <span className="text-[13px] text-muted">Shared with the client’s written approval.</span>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <Suspense fallback={null}>
        <ReportNotice />
      </Suspense>
      <section aria-labelledby="reviews" className="mt-16 max-w-[880px]">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 id="reviews" className={h2Big}>
            Reviews
          </h2>
          {rating.data?.rating ? (
            <span className="text-[14px] font-semibold">
              ★ {Number(rating.data.rating).toFixed(1)} <span className="font-normal text-muted">({rating.data.review_count} verified)</span>
            </span>
          ) : null}
        </div>
        <div className="mt-3 border-t-2 border-ink">
          {reviews.data?.length ? (
            reviews.data.map((r) => (
              <article key={r.id} className="flex flex-col gap-2 border-b border-line-strong py-6">
                <div className="flex flex-wrap justify-between gap-3">
                  <span className="text-[16px] font-semibold">{r.author}</span>
                  <span role="img" aria-label={`${r.rating} out of 5`} className="tracking-[2px]">
                    {'★'.repeat(r.rating)}
                    <span className="text-line-strong">{'★'.repeat(5 - r.rating)}</span>
                  </span>
                </div>
                <span className="text-[13px] font-semibold text-success">
                  ✓ Verified client · {r.package_title}, {paidFor(r.package_kind, r.months_paid)} · {r.month}
                </span>
                <p className="m-0 max-w-[64ch] text-[16px] leading-[1.6] text-ink-soft">{r.body}</p>
                {r.coach_reply ? (
                  <p className="m-0 mt-1 border-l-2 border-line-strong pl-3 text-[15px] text-ink-soft">
                    <span className="font-medium text-ink">Reply from {name.data || 'the coach'}:</span> {r.coach_reply}
                  </p>
                ) : null}
                {viewer ? <ReportForm kind="review" target={r.id} back={`/coaches/${id}`} label={`the review by ${r.author}`} /> : null}
              </article>
            ))
          ) : (
            <p className="m-0 py-6 text-[16px] text-ink-soft">No reviews yet. Only clients with a paid, finished engagement can review.</p>
          )}
        </div>
      </section>

      {viewer && viewer.userId !== id ? (
        <div className="mt-10">
          <ReportForm kind="coach" target={id} back={`/coaches/${id}`} label="this coach" />
        </div>
      ) : null}
    </>
  );
}

export default function CoachPage(props: PageProps<'/coaches/[id]'>) {
  return (
    <main className="mx-auto flex w-full max-w-[1440px] flex-col px-4 pb-24 pt-6 md:px-10">
      <Suspense fallback={null}>
        <Coach {...props} />
      </Suspense>
    </main>
  );
}
