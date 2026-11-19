import { Tag } from '@fitsphere/ui';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { formatInr } from '@fitsphere/core';
import { isUuid } from '@/lib/programs';
import { supabaseServer } from '@/lib/supabase/server';

// Each coach page names its coach, for tabs, search results and link previews.
export async function generateMetadata({ params }: PageProps<'/coaches/[id]'>): Promise<Metadata> {
  const { id } = await params;
  if (!isUuid(id)) return { title: 'Coach · FitSphere' };
  const supabase = await supabaseServer();
  const [name, profile] = await Promise.all([
    supabase.rpc('coach_public_name', { coach: id }),
    supabase.from('coach_profiles').select('headline').eq('coach_id', id).maybeSingle(),
  ]);
  if (!name.data) return { title: 'Coach · FitSphere' };
  return { title: `${name.data} · Coach on FitSphere`, description: profile.data?.headline || undefined };
}

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// P-Coach (first version, M4-02): a live coach's public profile. RLS returns only live coaches, their live packages and
// slots, and checked credentials. Stats come from a definer function over FitSphere records (M4-05). Programs are
// private (invite only), so the portfolio lists published lessons only until coaches can choose to list a program.
// shortcut: reviews arrive with M4-14 and Hire with M4-07; until then the page says so.
async function Coach({ params }: PageProps<'/coaches/[id]'>) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const supabase = await supabaseServer();
  const [profile, name, packages, slots, credentials, stats, lessons] = await Promise.all([
    supabase.from('coach_profiles').select('headline, philosophy, specialties, languages, formats, city, years').eq('coach_id', id).maybeSingle(),
    supabase.rpc('coach_public_name', { coach: id }),
    supabase.from('packages').select('id, title, kind, price_paise').eq('coach_id', id).eq('live', true).order('price_paise'),
    supabase.from('availability_slots').select('dow, start_time, minutes').eq('coach_id', id).order('dow').order('start_time'),
    supabase.from('public_credentials').select('id, title, issuer').eq('coach_id', id),
    supabase.rpc('coach_stats', { coach: id }).maybeSingle(),
    supabase.from('content_items').select('slug, title, disciplines!inner(category_id)').eq('author_id', id).eq('status', 'published').eq('is_sample', false).order('title').limit(6),
  ]);
  for (const r of [profile, name, packages, slots, credentials, stats, lessons]) if (r.error) throw r.error;
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

  return (
    <>
      <div className="flex flex-col gap-2">
        <p className="m-0 text-[15px] text-muted">
          {[p.city, p.years ? `${p.years} years coaching (self-reported)` : '', p.formats.map((f) => (f === 'in_person' ? 'In person' : 'Online')).join(' and ')].filter(Boolean).join(' · ')}
        </p>
        <h1 className="m-0 font-display text-[48px] font-normal uppercase leading-[0.95] md:text-[64px]">{name.data}</h1>
        <p className="m-0 text-[18px]">{p.headline}</p>
        <div className="flex flex-wrap gap-2">
          {credentials.data!.length ? <Tag variant="success">Credentials checked</Tag> : <Tag variant="outline">Credentials self-reported</Tag>}
          {p.specialties.map((s) => (
            <Tag key={s} variant="outline">
              {s}
            </Tag>
          ))}
        </div>
      </div>

      {statRows.length ? (
        <section aria-labelledby="stats" className="flex flex-col gap-3">
          <div>
            <h2 id="stats" className="m-0 text-[22px] font-semibold">
              On FitSphere
            </h2>
            <p className="m-0 text-[14px] text-muted">From FitSphere records, not entered by the coach.</p>
          </div>
          <dl className="m-0 grid grid-cols-2 gap-4 md:grid-cols-4">
            {statRows.map(([label, value]) => (
              <div key={label} className="flex flex-col-reverse gap-1 border-t border-line pt-3">
                <dt className="text-[14px] text-muted">{label}</dt>
                <dd className="m-0 text-[28px] font-semibold leading-none">{value}</dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}

      {p.philosophy ? (
        <section aria-labelledby="how" className="flex flex-col gap-2">
          <h2 id="how" className="m-0 text-[22px] font-semibold">
            How I coach
          </h2>
          <p className="m-0 whitespace-pre-line text-[16px] text-ink-soft">{p.philosophy}</p>
        </section>
      ) : null}

      <section aria-labelledby="packages" className="flex flex-col gap-2">
        <h2 id="packages" className="m-0 text-[22px] font-semibold">
          Packages
        </h2>
        <ul className="m-0 flex list-none flex-col border-t border-line p-0">
          {packages.data!.map((k) => (
            <li key={k.id} className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line py-3">
              <span className="text-[16px] font-medium">{k.title}</span>
              <span className="text-[16px]">
                {formatInr(k.price_paise)}
                {k.kind === 'monthly' ? ' a month' : ' a session'}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {credentials.data!.length ? (
        <section aria-labelledby="checked" className="flex flex-col gap-2">
          <h2 id="checked" className="m-0 text-[22px] font-semibold">
            Credentials checked by FitSphere
          </h2>
          <ul className="m-0 flex flex-col gap-1 pl-5 text-[16px]">
            {credentials.data!.map((c) => (
              <li key={c.id}>
                {c.title}
                {c.issuer ? <span className="text-muted"> · {c.issuer}</span> : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {slots.data!.length ? (
        <section aria-labelledby="slots" className="flex flex-col gap-2">
          <h2 id="slots" className="m-0 text-[22px] font-semibold">
            Weekly 1:1 slots
          </h2>
          <p className="m-0 text-[16px] text-ink-soft">{slots.data!.map((s) => `${DAYS[s.dow - 1]} ${s.start_time.slice(0, 5)}`).join(' · ')} (India time)</p>
        </section>
      ) : null}
      {lessons.data!.length ? (
        <section aria-labelledby="portfolio" className="flex flex-col gap-2">
          <h2 id="portfolio" className="m-0 text-[22px] font-semibold">
            Portfolio
          </h2>
          <ul className="m-0 flex list-none flex-col border-t border-line p-0">
            {lessons.data!.map((l) => (
              <li key={l.slug} className="flex flex-col gap-0.5 border-b border-line py-3">
                <Link href={`/learn/${l.disciplines.category_id}/${l.slug}`} className="text-[16px] font-medium">
                  Lesson: {l.title}
                </Link>
                <span className="text-[14px] text-muted">Coach-verified lesson on FitSphere</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section aria-labelledby="reviews" className="flex flex-col gap-2">
        <h2 id="reviews" className="m-0 text-[22px] font-semibold">
          Reviews
        </h2>
        <p className="m-0 text-[16px] text-ink-soft">No reviews yet. Only clients with a paid, finished engagement can review.</p>
      </section>

      {p.languages.length ? <p className="m-0 text-[15px] text-muted">Speaks {p.languages.join(', ')}.</p> : null}
    </>
  );
}

export default function CoachPage(props: PageProps<'/coaches/[id]'>) {
  return (
    <main className="mx-auto flex w-full max-w-[960px] flex-col gap-8 px-4 pb-24 pt-8 md:px-10">
      <Suspense fallback={null}>
        <Coach {...props} />
      </Suspense>
    </main>
  );
}
