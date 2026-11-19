import { Tag } from '@fitsphere/ui';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { COACH_AGREEMENT, COACH_AGREEMENT_VERSION } from '@/lib/coach-agreement';
import { paiseToRupees } from '@/lib/money';
import { supabaseServer } from '@/lib/supabase/server';
import { requireRole } from '@/lib/viewer';
import { AgreementButton, LiveForm, PackageForm, ProfileForm, SlotsEditor } from './forms';

export const metadata: Metadata = { title: 'Marketplace profile · FitSphere Coach' };

// X-CoachProfile: the coach's marketplace profile. Private columns come through my_coach_profile.
async function Editor() {
  const viewer = await requireRole('coach');
  const supabase = await supabaseServer();
  const [profile, packages, slots, credentials] = await Promise.all([
    supabase.rpc('my_coach_profile').maybeSingle(),
    supabase.from('packages').select('id, title, kind, price_paise, live').eq('coach_id', viewer.userId).order('created_at'),
    supabase.from('availability_slots').select('dow, start_time, minutes').eq('coach_id', viewer.userId).order('dow').order('start_time'),
    supabase.from('credentials').select('status').eq('coach_id', viewer.userId).neq('status', 'withdrawn'),
  ]);
  for (const r of [profile, packages, slots, credentials]) if (r.error) throw r.error;
  const p = profile.data;
  const accepted = p?.agreement_version === COACH_AGREEMENT_VERSION;
  const live = p?.status === 'live';
  const checked = credentials.data!.filter((c) => c.status === 'checked').length;

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <Tag variant={live ? 'success' : p?.status === 'suspended' ? 'danger' : 'outline'}>{live ? 'Live' : p?.status === 'suspended' ? 'Suspended' : 'Not live yet'}</Tag>
        {live ? (
          <Link href={`/coaches/${viewer.userId}`} className="text-[15px] font-medium underline underline-offset-4">
            Preview public profile
          </Link>
        ) : null}
      </div>

      <section aria-labelledby="about" className="flex flex-col gap-3">
        <h2 id="about" className="m-0 text-[22px] font-semibold">
          About you
        </h2>
        <ProfileForm
          values={{
            headline: p?.headline ?? '',
            philosophy: p?.philosophy ?? '',
            specialties: p?.specialties ?? [],
            languages: p?.languages ?? [],
            formats: p?.formats ?? [],
            city: p?.city ?? '',
            years: p?.years ?? 0,
            clientLimit: p?.client_limit ?? 10,
          }}
        />
      </section>

      <section aria-labelledby="creds" className="flex flex-col gap-2">
        <h2 id="creds" className="m-0 text-[22px] font-semibold">
          Credentials
        </h2>
        <p className="m-0 text-[15px] text-ink-soft">{checked ? `${checked} checked by FitSphere.` : 'None checked yet. Until then your profile shows experience as self-reported.'}</p>
        <Link href="/coach/profile/credentials" className="self-start text-[15px] font-medium underline underline-offset-4">
          Upload or manage credentials
        </Link>
      </section>

      {p ? (
        <>
          <section aria-labelledby="packages" className="flex flex-col gap-1">
            <h2 id="packages" className="m-0 text-[22px] font-semibold">
              Packages and prices
            </h2>
            {packages.data!.map((k) => (
              <PackageForm key={k.id} pkg={{ id: k.id, title: k.title, kind: k.kind, price: paiseToRupees(k.price_paise), live: k.live }} />
            ))}
            <PackageForm />
            <p className="m-0 text-[13px] text-muted">You receive the price minus the FitSphere fee, shown here once the fee is set.</p>
          </section>

          <section aria-labelledby="slots" className="flex flex-col gap-3">
            <h2 id="slots" className="m-0 text-[22px] font-semibold">
              Weekly 1:1 slots
            </h2>
            <SlotsEditor initial={slots.data!.map((s) => ({ dow: s.dow, start: s.start_time.slice(0, 5), minutes: s.minutes }))} />
          </section>

          <section aria-labelledby="agreement" className="flex flex-col gap-3 border border-line p-5">
            <h2 id="agreement" className="m-0 text-[22px] font-semibold">
              Coach agreement
            </h2>
            <ul className="m-0 flex flex-col gap-2 pl-5 text-[15px] text-ink-soft">
              {COACH_AGREEMENT.map(([title, text]) => (
                <li key={title}>
                  <strong className="font-medium text-ink">{title}.</strong> {text}
                </li>
              ))}
            </ul>
            <p className="m-0 text-[13px] text-muted">Version {COACH_AGREEMENT_VERSION}.</p>
            {accepted ? <p className="m-0 text-[15px] font-medium text-success">You accepted this version.</p> : <AgreementButton />}
          </section>

          <section aria-labelledby="publish" className="flex flex-col gap-2">
            <h2 id="publish" className="m-0 text-[22px] font-semibold">
              {live ? 'Your profile is live' : p.status === 'suspended' ? 'Your profile is suspended' : 'Go live'}
            </h2>
            <p className="m-0 text-[15px] text-ink-soft">
              {live
                ? 'Athletes can find you and hire you.'
                : p.status === 'suspended'
                  ? 'FitSphere suspended your profile, so athletes cannot find you. Contact FitSphere to resolve it.'
                  : 'To go live you need a headline, at least one live package, and the accepted agreement.'}
            </p>
            {p.status === 'suspended' ? null : <LiveForm live={live} />}
          </section>
        </>
      ) : (
        <p className="m-0 text-[15px] text-muted">Save the section above to start your marketplace profile.</p>
      )}
    </>
  );
}

export default function CoachProfilePage() {
  return (
    <main className="mx-auto flex w-full max-w-[960px] flex-col gap-8 px-4 pb-24 pt-8 md:px-10">
      <h1 className="m-0 font-display text-[48px] font-normal uppercase leading-[0.95]">Your marketplace profile</h1>
      <Suspense fallback={null}>
        <Editor />
      </Suspense>
    </main>
  );
}
