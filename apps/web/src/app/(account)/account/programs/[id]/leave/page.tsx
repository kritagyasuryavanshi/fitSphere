import { Button, buttonClass } from '@fitsphere/ui';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { isUuid } from '@/lib/programs';
import { supabaseServer } from '@/lib/supabase/server';
import { requireSignedIn } from '@/lib/viewer';
import { leaveProgram } from '../../actions';

export const metadata: Metadata = { title: 'Leave the program? · FitSphere' };

async function Confirm({ params, searchParams }: PageProps<'/account/programs/[id]/leave'>) {
  await requireSignedIn();
  const { id } = await params;
  const { error } = await searchParams;
  if (!isUuid(id)) notFound();
  const supabase = await supabaseServer();
  const { data, error: readError } = await supabase.rpc('my_programs');
  if (readError) throw readError;
  const program = data.find((p) => p.enrollment_id === id);
  if (!program) notFound();
  const coach = program.coach_name || 'Your coach';
  return (
    <section role="alertdialog" aria-modal="true" aria-labelledby="dlg-title" aria-describedby="dlg-text" className="flex flex-col gap-5 border border-line-strong p-6">
      <h1 id="dlg-title" className="m-0 font-display text-[40px] font-normal uppercase leading-[0.95]">
        Leave {program.title}?
      </h1>
      <p id="dlg-text" className="m-0 text-[16px] leading-[1.6] text-ink-soft">
        Its sessions leave Today, and {coach} stops seeing your logs and sign-up answers at once. Past feedback from {coach} stays with you.
      </p>
      {error ? (
        <p role="alert" className="m-0 text-[15px] font-medium text-danger">
          We could not take you out of the program. Try again.
        </p>
      ) : null}
      <form action={leaveProgram} className="flex flex-wrap gap-3">
        <input type="hidden" name="enrollment" value={id} />
        <Button type="submit" variant="danger">
          Leave program
        </Button>
        <Link href="/account/programs" className={buttonClass({ variant: 'light' })}>
          Keep training
        </Link>
      </form>
    </section>
  );
}

// The leave confirm on T-MyPrograms: leaving needs this screen; the button lives only here.
export default function LeavePage(props: PageProps<'/account/programs/[id]/leave'>) {
  return (
    <main className="mx-auto flex max-w-xl flex-col px-4 py-16">
      <Suspense fallback={null}>
        <Confirm {...props} />
      </Suspense>
    </main>
  );
}
