import { Button, buttonClass } from '@fitsphere/ui';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { isUuid, ownProgram } from '@/lib/programs';
import { supabaseServer } from '@/lib/supabase/server';
import { requireRole } from '@/lib/viewer';
import { removeAthlete } from '../../actions';

export const metadata: Metadata = { title: 'Remove the athlete? · FitSphere Coach' };

async function Confirm({ params, searchParams }: PageProps<'/coach/programs/[id]/members/[enrollment]/remove'>) {
  const viewer = await requireRole('coach');
  const { id, enrollment } = await params;
  const { error } = await searchParams;
  const program = await ownProgram(id, viewer);
  if (!isUuid(enrollment)) notFound();
  const supabase = await supabaseServer();
  const { data, error: readError } = await supabase.rpc('program_members', { program: id });
  if (readError) throw readError;
  const member = data.find((m) => m.enrollment_id === enrollment);
  if (!member) notFound();
  const name = member.display_name || 'this athlete';
  return (
    <section role="alertdialog" aria-modal="true" aria-labelledby="dlg-title" aria-describedby="dlg-text" className="flex flex-col gap-5 border border-line-strong p-6">
      <h1 id="dlg-title" className="m-0 font-display text-[40px] font-normal uppercase leading-[0.95]">
        Remove {name} from {program.title}?
      </h1>
      <p id="dlg-text" className="m-0 text-[16px] leading-[1.6] text-ink-soft">
        The sessions leave their Today, and you stop seeing their logs and sign-up answers at once. Your past feedback stays visible to them.
      </p>
      {error ? (
        <p role="alert" className="m-0 text-[15px] font-medium text-danger">
          We could not remove them. Try again.
        </p>
      ) : null}
      <form action={removeAthlete} className="flex flex-wrap gap-3">
        <input type="hidden" name="program" value={id} />
        <input type="hidden" name="enrollment" value={enrollment} />
        <Button type="submit" variant="danger">
          Remove {name}
        </Button>
        <Link href={`/coach/programs/${id}/invite`} className={buttonClass({ variant: 'light' })}>
          Keep them in the program
        </Link>
      </form>
    </section>
  );
}

// K-ConfirmRemove: removing needs this screen; the button lives only here.
export default function RemovePage(props: PageProps<'/coach/programs/[id]/members/[enrollment]/remove'>) {
  return (
    <main className="mx-auto flex max-w-xl flex-col px-4 py-16">
      <Suspense fallback={null}>
        <Confirm {...props} />
      </Suspense>
    </main>
  );
}
