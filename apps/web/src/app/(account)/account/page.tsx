import { buttonClass } from '@fitsphere/ui';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { supabaseServer } from '@/lib/supabase/server';
import { requireSignedIn } from '@/lib/viewer';
import { aiSwitches, boxingExperience, equipment as equipmentOptions, labelOf } from '../../welcome/options';
import { logOut, setConsent } from './actions';
import { NameForm } from './name-form';

export const metadata: Metadata = { title: 'Account · FitSphere' };

function Switch({ purpose, label, hint, on }: { purpose: string; label: string; hint: string; on: boolean }) {
  // A plain form, so the change is saved on the server at once; the newest consent row is the answer.
  return (
    <form action={setConsent} className="flex items-start justify-between gap-4 border-t border-line py-4">
      <input type="hidden" name="purpose" value={purpose} />
      <input type="hidden" name="on" value={on ? 'no' : 'yes'} />
      <div className="flex flex-col gap-1">
        <p className="m-0 text-[16px] font-medium">{label}</p>
        <p className="m-0 text-[14px] text-muted">
          {on ? 'On.' : 'Off.'} {hint}
        </p>
      </div>
      <button
        type="submit"
        role="switch"
        aria-checked={on}
        aria-label={label}
        className={`relative h-7 w-12 flex-none cursor-pointer rounded-pill transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink ${on ? 'bg-ink' : 'bg-line-strong'}`}
      >
        <span aria-hidden="true" className={`absolute top-1 size-5 rounded-full bg-paper transition-all ${on ? 'left-6' : 'left-1'}`} />
      </button>
    </form>
  );
}

async function Account() {
  const viewer = await requireSignedIn();
  const supabase = await supabaseServer();
  const [{ data: prefs }, { data: categories }, { data: basics }, { data: consents }, { data: notices }] = await Promise.all([
    supabase.from('athlete_prefs').select('category_id, answers').eq('user_id', viewer.userId),
    supabase.from('categories').select('id, name').order('sort'),
    supabase.from('athlete_basics').select('days_per_week, equipment').eq('user_id', viewer.userId).maybeSingle(),
    supabase.from('consents').select('purpose, granted, notice_version').eq('user_id', viewer.userId).order('created_at', { ascending: false }),
    supabase.from('consent_notices').select('purpose, version').eq('is_current', true),
  ]);
  const chosen = new Set((prefs ?? []).map((p) => p.category_id));
  const boxing = (prefs ?? []).find((p) => p.category_id === 'boxing')?.answers as Record<string, unknown> | undefined;
  // Rows come newest first, so the first one per purpose is the current answer. A yes counts only for the
  // current wording: after the notice changes, the switch shows Off until the person agrees again.
  const isOn = (purpose: string) => {
    const latest = consents?.find((c) => c.purpose === purpose);
    return latest?.granted === true && latest.notice_version === notices?.find((n) => n.purpose === purpose)?.version;
  };

  const training: [string, string][] = [['Sports', (categories ?? []).filter((c) => chosen.has(c.id)).map((c) => c.name).join(', ')]];
  if (boxing?.experience) training.push(['Experience', labelOf(boxingExperience, boxing.experience)]);
  if (basics) {
    training.push(['Days a week', String(basics.days_per_week)]);
    training.push(['Equipment', basics.equipment.map((e) => labelOf(equipmentOptions, e)).join(', ') || 'None']);
  }

  return (
    <>
      <section aria-labelledby="prof" className="flex flex-col gap-4">
        <h2 id="prof" className="m-0 text-[22px] font-medium">
          Profile
        </h2>
        <NameForm name={viewer.name} />
        <div className="flex flex-col gap-1">
          <p className="m-0 text-[15px] font-medium">Email</p>
          <p className="m-0 break-all text-[16px]">{viewer.email}</p>
          <p className="m-0 text-[13px] text-muted">We send sign-in links here.</p>
        </div>
      </section>

      <Link href="/account/programs" className="flex min-h-14 items-center justify-between border-t border-line text-[16px] font-medium">
        My programs <span aria-hidden="true">→</span>
      </Link>
      <Link href="/account/feedback" className="flex min-h-14 items-center justify-between border-t border-line text-[16px] font-medium">
        Coach feedback <span aria-hidden="true">→</span>
      </Link>
      <Link href="/account/saved" className="flex min-h-14 items-center justify-between border-y border-line text-[16px] font-medium">
        Saved and completed lessons <span aria-hidden="true">→</span>
      </Link>

      <section aria-labelledby="train" className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-4">
          <h2 id="train" className="m-0 text-[22px] font-medium">
            Training
          </h2>
          <Link href="/welcome/1" className="text-[15px] font-medium underline">
            Edit
          </Link>
        </div>
        <dl className="m-0 border-t border-line">
          {training.map(([term, value]) => (
            <div key={term} className="flex justify-between gap-4 border-b border-line py-3 text-[15px]">
              <dt className="text-muted">{term}</dt>
              <dd className="m-0 text-right font-medium">{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section aria-labelledby="ai" className="flex flex-col">
        <h2 id="ai" className="m-0 mb-2 text-[22px] font-medium">
          AI and privacy
        </h2>
        {aiSwitches.map((s) => (
          <Switch key={s.purpose} {...s} on={isOn(s.purpose)} />
        ))}
      </section>

      <section aria-labelledby="data" className="flex flex-col gap-4">
        <h2 id="data" className="m-0 text-[22px] font-medium">
          Your data
        </h2>
        <div className="flex flex-wrap gap-3">
          {/* A plain link: the browser downloads the file the route returns. */}
          <a href="/account/download" className={buttonClass({ variant: 'light' })}>
            Download my data
          </a>
          <Link href="/legal/privacy" className="self-center text-[15px] underline">
            Read the privacy policy
          </Link>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-4 border border-danger-soft bg-danger-soft p-4">
          <div>
            <p className="m-0 text-[16px] font-medium">Delete account</p>
            <p className="m-0 text-[14px] text-ink-soft">Removes your profile, logs and saved lessons. This cannot be undone.</p>
          </div>
          <Link href="/account/delete" className={buttonClass({ variant: 'danger' })}>
            Delete account
          </Link>
        </div>
      </section>

      <form action={logOut}>
        <button type="submit" className="cursor-pointer text-[15px] font-medium underline">
          Log out
        </button>
      </form>
    </>
  );
}

// T-Account. The other account pages in the mockup's side menu (programs, feedback, saved) come with their features.
export default function AccountPage() {
  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-10 px-4 py-10 md:px-10">
      <h1 className="m-0 font-display text-[48px] font-normal uppercase leading-[0.95] md:text-[64px]">Account</h1>
      <Suspense fallback={null}>
        <Account />
      </Suspense>
    </main>
  );
}
