import { formatInr } from '@fitsphere/core';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { supabaseServer } from '@/lib/supabase/server';
import { requireRole } from '@/lib/viewer';
import { openConversation } from '@/app/(account)/messages/actions';
import { AssignForm } from './assign-form';
import { DecideForm } from './decide-form';

export const metadata: Metadata = { title: 'Clients · FitSphere Coach' };

const sent = (iso: string) => new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(iso));

// X-CoachRequests: hire requests to accept or decline, and paying clients, who can be assigned a program (M4-10).
// Earnings arrive with M4-13.
async function Clients() {
  const viewer = await requireRole('coach');
  const supabase = await supabaseServer();
  const [rows, profile, owned] = await Promise.all([
    supabase.rpc('coach_requests'),
    supabase.rpc('my_coach_profile').maybeSingle(),
    supabase.from('programs').select('id, title, program_versions(published_at)').eq('coach_id', viewer.userId).order('title'),
  ]);
  if (rows.error) throw rows.error;
  if (profile.error) throw profile.error;
  if (owned.error) throw owned.error;
  // Only published programs can be assigned (assign_program checks it too).
  const programs = owned.data.filter((p) => p.program_versions.some((v) => v.published_at)).map(({ id, title }) => ({ id, title }));
  const requests = rows.data.filter((r) => r.status === 'requested' || r.status === 'accepted');
  const paying = rows.data.filter((r) => r.status === 'active' || r.status === 'cancelling');
  const taken = rows.data.filter((r) => r.status !== 'requested').length;
  const limit = profile.data?.client_limit ?? 0;
  const tiles: [string, string][] = [
    ['New requests', String(requests.filter((r) => r.status === 'requested').length)],
    ['Paying clients', String(paying.length)],
    ['Open places', String(Math.max(0, limit - taken))],
  ];

  return (
    <>
      <dl className="m-0 grid grid-cols-3 gap-4">
        {tiles.map(([label, value]) => (
          <div key={label} className="flex flex-col-reverse gap-1 border-t border-line pt-3">
            <dt className="text-[14px] text-muted">{label}</dt>
            <dd className="m-0 text-[28px] font-semibold leading-none">{value}</dd>
          </div>
        ))}
      </dl>
      {limit && taken >= limit ? <p className="m-0 text-[15px]">You are at your client limit, so new requests are paused.</p> : null}

      <section aria-labelledby="requests" className="flex flex-col gap-3">
        <h2 id="requests" className="m-0 text-[22px] font-semibold">
          Requests
        </h2>
        {requests.length ? (
          <ul className="m-0 flex list-none flex-col gap-4 p-0">
            {requests.map((r) => (
              <li key={r.engagement_id} className="flex flex-col gap-2 border border-line p-5">
                <p className="m-0 text-[18px] font-semibold">{r.athlete_name}</p>
                <p className="m-0 text-[15px] text-muted">
                  {r.package_title}, {formatInr(r.price_paise)}
                  {r.package_kind === 'monthly' ? ' / month' : ''} · sent {sent(r.created_at)} · starts {r.start_date} · {r.days_per_week} days a week
                </p>
                {r.goals ? <p className="m-0 whitespace-pre-line text-[16px]">“{r.goals}”</p> : null}
                <p className="m-0 text-[13px] text-muted">{r.share_data ? 'Shares training logs while a client.' : 'Does not share training logs.'}</p>
                {r.status === 'requested' ? <DecideForm engagementId={r.engagement_id} athlete={r.athlete_name} /> : <p className="m-0 text-[15px] font-medium">Accepted · awaiting payment</p>}
                <form action={openConversation}>
                  <input type="hidden" name="engagement" value={r.engagement_id} />
                  <button type="submit" className="text-[15px] font-medium underline underline-offset-4">
                    Message {r.athlete_name}
                  </button>
                </form>
              </li>
            ))}
          </ul>
        ) : (
          <p className="m-0 text-[15px] text-muted">No requests right now.</p>
        )}
      </section>

      <section aria-labelledby="paying" className="flex flex-col gap-3">
        <h2 id="paying" className="m-0 text-[22px] font-semibold">
          Paying clients
        </h2>
        {paying.length ? (
          // Stacked cards on phones, a table from md up (decision D3).
          <ul className="m-0 grid list-none gap-3 p-0 md:grid-cols-[1fr_1fr_auto] md:gap-x-4 md:gap-y-0">
            {paying.map((r) => (
              <li key={r.engagement_id} className="contents">
                <span className="border-line font-medium md:border-b md:py-3">{r.athlete_name}</span>
                <span className="border-line text-muted md:border-b md:py-3">{r.package_title}</span>
                <span className="flex flex-wrap gap-4 border-line md:border-b md:py-3">
                  {r.cancel_at_period_end ? `Cancels ${r.paid_through}` : r.paid_through ? `Renews ${r.paid_through}` : ''}
                  <form action={openConversation}>
                    <input type="hidden" name="engagement" value={r.engagement_id} />
                    <button type="submit" className="font-medium underline underline-offset-4">
                      Message {r.athlete_name}
                    </button>
                  </form>
                  <AssignForm engagementId={r.engagement_id} athlete={r.athlete_name} programs={programs} />
                  {r.share_data ? null : <span className="w-full text-[13px] text-muted">Does not share training logs, so you will not see their sessions.</span>}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="m-0 text-[15px] text-muted">No paying clients yet. Clients appear here once they pay.</p>
        )}
      </section>
    </>
  );
}

export default function ClientsPage() {
  return (
    <main className="mx-auto flex w-full max-w-[1100px] flex-col gap-8 px-4 pb-24 pt-8 md:px-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="m-0 font-display text-[48px] font-normal uppercase leading-[0.95]">Clients</h1>
        <div className="flex flex-wrap gap-4">
          <Link href="/messages" className="text-[15px] font-medium underline underline-offset-4">
            Messages
          </Link>
          <Link href="/coach/profile" className="text-[15px] font-medium underline underline-offset-4">
            Edit profile and prices
          </Link>
        </div>
      </div>
      <Suspense fallback={null}>
        <Clients />
      </Suspense>
    </main>
  );
}
