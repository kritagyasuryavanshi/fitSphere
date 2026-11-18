import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { supabaseServer } from '@/lib/supabase/server';
import { requireRole } from '@/lib/viewer';
import { NewProgramForm } from './new-program-form';

export const metadata: Metadata = { title: 'New program · FitSphere Coach' };

async function Form() {
  await requireRole('coach');
  const supabase = await supabaseServer();
  const { data, error } = await supabase.from('categories').select('id, name').eq('is_live', true).order('sort');
  if (error) throw error;
  return <NewProgramForm categories={data} />;
}

export default function NewProgramPage() {
  return (
    <main className="mx-auto flex w-full max-w-[640px] flex-col gap-6 px-4 pb-20 pt-8 md:px-10">
      <Link href="/coach/programs" className="self-start text-[14px] font-medium underline underline-offset-4">
        Programs
      </Link>
      <h1 className="m-0 font-display text-[48px] font-normal uppercase leading-[0.95]">New program</h1>
      <Suspense fallback={null}>
        <Form />
      </Suspense>
    </main>
  );
}
