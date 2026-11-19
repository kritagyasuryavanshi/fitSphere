import { Tag } from '@fitsphere/ui';
import type { Metadata } from 'next';
import { Suspense } from 'react';
import { supabaseServer } from '@/lib/supabase/server';
import { requireRole } from '@/lib/viewer';
import { removeCredential } from './actions';
import { UploadForm } from './upload-form';

export const metadata: Metadata = { title: 'Credentials · FitSphere Coach' };

const day = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' });

// M4-03: the coach's credentials. An admin checks each against its issuer; checked ones give the public badge.
async function Credentials() {
  const viewer = await requireRole('coach');
  const supabase = await supabaseServer();
  const [{ data, error }, profile] = await Promise.all([
    supabase
      .from('credentials')
      .select('id, title, issuer, status, note, created_at, decided_at')
      .eq('coach_id', viewer.userId)
      .neq('status', 'withdrawn')
      .order('created_at', { ascending: false }),
    supabase.from('coach_profiles').select('status').eq('coach_id', viewer.userId).maybeSingle(),
  ]);
  if (error) throw error;
  if (profile.error) throw profile.error;
  const checked = data.some((c) => c.status === 'checked');
  // The public sees the badge only on a live profile (public_credentials needs both).
  const live = profile.data?.status === 'live';
  return (
    <>
      {checked ? (
        <p className="m-0 flex flex-wrap items-center gap-2">
          <Tag variant="success">Credentials checked</Tag>
          <span className="text-[14px] text-muted">{live ? 'Shown on your public profile.' : 'Shows on your public profile once it is live.'}</span>
        </p>
      ) : null}
      {data.length ? (
        <ul aria-label="Your credentials" className="m-0 flex list-none flex-col border-t border-line p-0">
          {data.map((c) => (
            <li key={c.id} className="flex flex-col gap-1 border-b border-line py-3">
              <span className="flex flex-wrap items-center gap-2">
                <span className="text-[16px] font-medium">{c.title}</span>
                <Tag variant={c.status === 'checked' ? 'success' : c.status === 'rejected' ? 'danger' : 'outline'}>
                  {c.status === 'checked' ? 'Checked' : c.status === 'rejected' ? 'Not accepted' : 'Waiting for a check'}
                </Tag>
              </span>
              <span className="text-[14px] text-muted">
                {c.issuer ? `${c.issuer} · ` : ''}uploaded {day.format(new Date(c.created_at))}
              </span>
              {c.status === 'rejected' && c.note ? <span className="text-[15px] text-ink-soft">Why: {c.note}</span> : null}
              <form action={removeCredential} className="mt-1">
                <input type="hidden" name="credential" value={c.id} />
                <button type="submit" className="min-h-11 text-[14px] font-medium text-danger underline underline-offset-4">
                  Remove<span className="sr-only">: {c.title}</span>
                </button>
              </form>
            </li>
          ))}
        </ul>
      ) : (
        <p className="m-0 bg-mist p-6 text-[16px] text-ink-soft">No credentials yet. Add a certificate, and an admin checks it against its issuer.</p>
      )}
      <section aria-labelledby="add" className="flex flex-col gap-3 border border-line p-5">
        <h2 id="add" className="m-0 text-[20px] font-semibold">
          Add a credential
        </h2>
        <UploadForm userId={viewer.userId} />
        <p className="m-0 text-[13px] text-muted">Only you and FitSphere admins can open the file. The public sees the title and issuer once it is checked.</p>
      </section>
    </>
  );
}

export default function CredentialsPage() {
  return (
    <main className="mx-auto flex w-full max-w-[760px] flex-col gap-6 px-4 pb-24 pt-8 md:px-10">
      <h1 className="m-0 font-display text-[48px] font-normal uppercase leading-[0.95]">Credentials</h1>
      <Suspense fallback={null}>
        <Credentials />
      </Suspense>
    </main>
  );
}
