import { buttonClass } from '@fitsphere/ui';
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { supabaseServer } from '@/lib/supabase/server';
import { requireRole } from '@/lib/viewer';
import { CopyLink } from './copy-link';

export const metadata: Metadata = { title: 'Invite athletes · FitSphere Coach' };

const day = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' });

async function Invite({ params, searchParams }: PageProps<'/coach/programs/[id]/invite'>) {
  const viewer = await requireRole('coach');
  const { id } = await params;
  const { reset } = await searchParams;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const supabase = await supabaseServer();
  const { data: program } = await supabase.from('programs').select('id, title').eq('id', id).eq('coach_id', viewer.userId).maybeSingle();
  if (!program) notFound();
  // Makes the program's code on first visit; the same code comes back until a reset.
  const [code, members] = await Promise.all([supabase.rpc('program_invite', { program: id }), supabase.rpc('program_members', { program: id })]);
  if (code.error) throw code.error;
  if (members.error) throw members.error;
  const h = await headers();
  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? `${h.get('x-forwarded-proto') ?? 'http'}://${h.get('host')}`;

  return (
    <>
      <h1 className="m-0 font-display text-[48px] font-normal uppercase leading-[0.95] md:text-[64px]">Invite athletes</h1>
      <p className="m-0 text-[18px] font-medium">{program.title}</p>
      {reset === '1' ? (
        <p role="status" className="m-0 bg-success-soft p-4 text-[15px] font-medium text-success">
          New link made. The old link no longer works.
        </p>
      ) : reset === 'failed' ? (
        <p role="alert" className="m-0 bg-danger-soft p-4 text-[15px] font-medium text-danger">
          We could not reset the link. Try again.
        </p>
      ) : null}
      <CopyLink url={`${origin}/join/${code.data}`} title={program.title} />
      <p className="m-0 text-[15px] text-muted">Athletes must sign in and finish sign-up before they join. You see each person who joins.</p>

      <section aria-labelledby="joined" className="flex flex-col gap-3">
        <h2 id="joined" className="m-0 text-[20px] font-medium">
          Joined · {members.data.length}
        </h2>
        {members.data.length ? (
          <ul aria-label="Joined athletes" className="m-0 flex list-none flex-col border-t border-line p-0">
            {members.data.map((m) => (
              <li key={m.enrollment_id} className="flex items-center justify-between gap-4 border-b border-line py-3">
                <span className="text-[16px] font-medium">{m.display_name || 'Athlete'}</span>
                <span className="text-[14px] text-muted">{day.format(new Date(m.joined_at))}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="m-0 bg-mist p-6 text-[16px] text-muted">Nobody has joined yet.</p>
        )}
      </section>

      <section aria-labelledby="reset" className="flex flex-col items-start gap-3 border border-line p-5">
        <h2 id="reset" className="m-0 text-[18px] font-medium">
          Link shared too widely?
        </h2>
        <p className="m-0 text-[15px] text-muted">Reset it. The old link stops working at once. People who already joined stay in the program.</p>
        <Link href={`/coach/programs/${id}/invite/reset`} className={buttonClass({ variant: 'light' })}>
          Reset link
        </Link>
      </section>
    </>
  );
}

export default function InvitePage(props: PageProps<'/coach/programs/[id]/invite'>) {
  return (
    <main className="mx-auto flex w-full max-w-[760px] flex-col gap-6 px-4 pb-20 pt-8 md:px-10">
      <Link href="/coach/programs" className="self-start text-[14px] font-medium underline underline-offset-4">
        Programs
      </Link>
      <Suspense fallback={null}>
        <Invite {...props} />
      </Suspense>
    </main>
  );
}
