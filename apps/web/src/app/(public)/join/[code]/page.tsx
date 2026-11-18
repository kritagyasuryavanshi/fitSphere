import { buttonClass } from '@fitsphere/ui';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { supabaseServer } from '@/lib/supabase/server';
import { getViewer } from '@/lib/viewer';
import { JoinForm } from './join-form';

export const metadata: Metadata = { title: 'Program invite · FitSphere', robots: { index: false } };

function Notice({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col items-start gap-4">
      <h1 className="m-0 font-display text-[40px] font-normal uppercase leading-[0.95] md:text-[56px]">{title}</h1>
      {children}
    </section>
  );
}

async function Invite({ params, searchParams }: PageProps<'/join/[code]'>) {
  const { code } = await params;
  const { joined } = await searchParams;
  if (!/^[0-9a-f]{32}$/.test(code)) notFound();
  const [viewer, supabase] = await Promise.all([getViewer(), supabaseServer()]);
  const { data, error } = await supabase.rpc('invite_info', { code });
  if (error) throw error;
  const info = data[0];
  if (!info) notFound();

  if (!info.active) {
    return (
      <Notice title="This link is no longer active">
        <p className="m-0 text-[17px] text-ink-soft">Ask your coach for a new invite link.</p>
      </Notice>
    );
  }
  if (!info.published) {
    return (
      <Notice title="Not open yet">
        <p className="m-0 text-[17px] text-ink-soft">
          {info.coach_name || 'Your coach'} has not published {info.title} yet. Open this link again once they tell you it is ready.
        </p>
      </Notice>
    );
  }

  const enrolled = viewer
    ? !!(await supabase.from('enrollments').select('id').eq('program_id', info.program_id!).eq('athlete_id', viewer.userId).eq('status', 'active').maybeSingle()).data
    : false;
  const coach = info.coach_name || 'Your coach';

  return (
    <section className="flex flex-col items-start gap-5">
      <p className="m-0 text-[15px] font-medium uppercase tracking-wide text-muted">{coach} invited you to</p>
      <h1 className="m-0 font-display text-[48px] font-normal uppercase leading-[0.95] md:text-[72px]">{info.title}</h1>
      <p className="m-0 text-[16px] text-muted">
        {info.weeks} {info.weeks === 1 ? 'week' : 'weeks'}
      </p>
      {info.summary ? <p className="m-0 text-[17px] text-ink-soft">{info.summary}</p> : null}
      <p className="m-0 text-[16px] leading-[1.6] text-ink-soft">
        Sessions appear in Today. {coach} sees your logs and sign-up answers while you are in this program. Leave any time, and their access ends at
        once.
      </p>
      {joined === '1' || enrolled ? (
        <div role="status" className="flex flex-col items-start gap-3 bg-success-soft p-5">
          <p className="m-0 text-[16px] font-medium text-success">You are in {info.title}. Your first session is in Today.</p>
          <Link href="/today" className={buttonClass()}>
            Go to Today
          </Link>
        </div>
      ) : viewer ? (
        <JoinForm code={code} />
      ) : (
        <div className="flex flex-col items-start gap-3">
          <p className="m-0 text-[16px] font-medium">Sign in or join FitSphere first, then open this link again to join.</p>
          <Link href="/sign-in" className={buttonClass({ variant: 'volt' })}>
            Sign in or join free
          </Link>
        </div>
      )}
    </section>
  );
}

// A-Invite: what an invite link opens, for guests and signed-in people alike.
export default function JoinPage(props: PageProps<'/join/[code]'>) {
  return (
    <main className="mx-auto flex w-full max-w-[760px] flex-col gap-6 px-4 pb-20 pt-12 md:px-10">
      <Suspense fallback={null}>
        <Invite {...props} />
      </Suspense>
    </main>
  );
}
