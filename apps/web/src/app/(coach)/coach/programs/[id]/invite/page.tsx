import { buttonClass } from '@fitsphere/ui';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { ownProgram } from '@/lib/programs';
import { siteOrigin } from '@/lib/site-origin';
import { supabaseServer } from '@/lib/supabase/server';
import { requireRole } from '@/lib/viewer';
import { CopyLink } from './copy-link';

export const metadata: Metadata = { title: 'Invite athletes · FitSphere Coach' };

const day = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' });

async function Invite({ params, searchParams }: PageProps<'/coach/programs/[id]/invite'>) {
  const viewer = await requireRole('coach');
  const { id } = await params;
  const { reset, removed } = await searchParams;
  const program = await ownProgram(id, viewer);
  const supabase = await supabaseServer();
  // Makes the program's code on first visit; the same code comes back until a reset.
  const [code, members, origin] = await Promise.all([supabase.rpc('program_invite', { program: id }), supabase.rpc('program_members', { program: id }), siteOrigin()]);
  if (code.error) throw code.error;
  if (members.error) throw members.error;

  return (
    <>
      <h1 className="m-0 font-display text-[48px] font-normal uppercase leading-[0.95] md:text-[64px]">Invite athletes</h1>
      <p className="m-0 text-[18px] font-medium">{program.title}</p>
      {reset === '1' ? (
        <p role="status" className="m-0 bg-success-soft p-4 text-[15px] font-medium text-success">
          New link made. The old link no longer works.
        </p>
      ) : removed === '1' ? (
        <p role="status" className="m-0 bg-success-soft p-4 text-[15px] font-medium text-success">
          Removed. You no longer see their logs or sign-up answers, and the link does not let them back in.
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
              <li key={m.enrollment_id} className="flex items-center gap-4 border-b border-line py-3">
                <span className="flex-1 text-[16px] font-medium">{m.display_name || 'Athlete'}</span>
                <span className="text-[14px] text-muted">{day.format(new Date(m.joined_at))}</span>
                <Link
                  href={`/coach/programs/${id}/members/${m.enrollment_id}/remove`}
                  className="inline-flex min-h-11 items-center text-[14px] font-medium text-danger underline underline-offset-4"
                >
                  Remove<span className="sr-only"> {m.display_name || 'athlete'}</span>
                </Link>
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
