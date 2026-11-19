import type { Metadata } from 'next';
import { Suspense } from 'react';
import { supabaseServer } from '@/lib/supabase/server';
import { requireRole } from '@/lib/viewer';
import { DecisionForm } from './decision-form';

export const metadata: Metadata = { title: 'Credential checks · FitSphere Admin' };

const day = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' });

// X-Verify: pending credentials, oldest first. Each document opens through a signed link that expires in 10 minutes,
// so the private file is never public.
async function Queue() {
  await requireRole('admin');
  const supabase = await supabaseServer();
  const { data, error } = await supabase.rpc('admin_pending_credentials');
  if (error) throw error;
  const links = data.length ? await supabase.storage.from('credentials').createSignedUrls(data.map((c) => c.file_path), 600) : { data: [], error: null };
  if (links.error) throw links.error;
  const url = new Map((links.data ?? []).map((l) => [l.path, l.signedUrl]));
  if (!data.length) return <p className="m-0 bg-mist p-6 text-[16px] text-ink-soft">No credentials are waiting for a check.</p>;
  return (
    <ul aria-label="Pending credentials" className="m-0 flex list-none flex-col gap-4 p-0">
      {data.map((c) => (
        <li key={c.id} className="flex flex-col gap-3 border border-line p-5">
          <div className="flex flex-col gap-1">
            <span className="text-[17px] font-medium">{c.coach_name}</span>
            <span className="text-[16px]">{c.title}</span>
            <span className="text-[14px] text-muted">
              {c.issuer ? `Issuer: ${c.issuer}` : 'No issuer given'}
              {c.id_number ? ` · number ${c.id_number}` : ''} · uploaded {day.format(new Date(c.created_at))}
            </span>
          </div>
          {url.get(c.file_path) ? (
            <a href={url.get(c.file_path)!} target="_blank" rel="noopener noreferrer" className="self-start text-[15px] font-medium underline underline-offset-4">
              Open document<span className="sr-only">: {c.title}</span>
            </a>
          ) : (
            <span className="text-[14px] text-danger">The file could not be opened.</span>
          )}
          <DecisionForm credential={c.id} title={c.title} />
        </li>
      ))}
    </ul>
  );
}

export default function CredentialChecksPage() {
  return (
    <main className="mx-auto flex w-full max-w-[960px] flex-col gap-6 px-4 pb-24 pt-8 md:px-10">
      <div className="flex flex-col gap-2">
        <h1 className="m-0 font-display text-[48px] font-normal uppercase leading-[0.95]">Credential checks</h1>
        <p className="m-0 max-w-[70ch] text-[15px] text-ink-soft">
          Check each document against the issuer before the profile shows &ldquo;Credentials checked&rdquo;. Never approve from a photo alone when the issuer
          offers a lookup. Each decision is logged with your name and the date.
        </p>
      </div>
      <Suspense fallback={null}>
        <Queue />
      </Suspense>
    </main>
  );
}
