import { Button, buttonClass } from '@fitsphere/ui';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { supabaseServer } from '@/lib/supabase/server';
import { requireRole } from '@/lib/viewer';
import { resetInvite } from '../actions';

export const metadata: Metadata = { title: 'Reset the invite link? · FitSphere Coach' };

async function Confirm({ params }: { params: PageProps<'/coach/programs/[id]/invite/reset'>['params'] }) {
  const viewer = await requireRole('coach');
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const supabase = await supabaseServer();
  const { data: program } = await supabase.from('programs').select('id, title').eq('id', id).eq('coach_id', viewer.userId).maybeSingle();
  if (!program) notFound();
  return (
    <section role="alertdialog" aria-modal="true" aria-labelledby="dlg-title" aria-describedby="dlg-text" className="flex flex-col gap-5 border border-line-strong p-6">
      <h1 id="dlg-title" className="m-0 font-display text-[40px] font-normal uppercase leading-[0.95]">
        Reset the invite link?
      </h1>
      <p id="dlg-text" className="m-0 text-[16px] leading-[1.6] text-ink-soft">
        The old link stops working at once. Athletes who already joined stay in {program.title}. Share the new link with anyone still waiting.
      </p>
      <form action={resetInvite} className="flex flex-wrap gap-3">
        <input type="hidden" name="id" value={program.id} />
        <Button type="submit" variant="danger">
          Reset link
        </Button>
        <Link href={`/coach/programs/${program.id}/invite`} className={buttonClass({ variant: 'light' })}>
          Cancel
        </Link>
      </form>
    </section>
  );
}

// K-ConfirmReset: resetting needs this screen; the button lives only here.
export default function ResetPage({ params }: PageProps<'/coach/programs/[id]/invite/reset'>) {
  return (
    <main className="mx-auto flex max-w-xl flex-col px-4 py-16">
      <Suspense fallback={null}>
        <Confirm params={params} />
      </Suspense>
    </main>
  );
}
