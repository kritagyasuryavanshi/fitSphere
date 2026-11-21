import { Button, buttonClass } from '@fitsphere/ui';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { requireSignedIn } from '@/lib/viewer';
import { deleteAccount } from '../actions';

export const metadata: Metadata = { title: 'Delete your account? · FitSphere' };

async function Confirm({ searchParams }: { searchParams: PageProps<'/account/delete'>['searchParams'] }) {
  await requireSignedIn();
  const { error } = await searchParams;
  return (
    <section role="alertdialog" aria-modal="true" aria-labelledby="dlg-title" aria-describedby="dlg-text" className="flex flex-col gap-5 border border-line-strong p-6">
      <h1 id="dlg-title" className="m-0 font-display text-[40px] font-normal uppercase leading-[0.95]">
        Delete your account?
      </h1>
      <p id="dlg-text" className="m-0 text-[16px] leading-[1.6] text-ink-soft">
        This removes your profile, session logs and saved lessons. Your coaches lose access at once. Payment records are kept, without your name. You cannot undo this.
      </p>
      {error === 'admin' ? (
        <p role="alert" className="m-0 text-[15px] font-medium text-danger">
          You are an admin. Ask another admin to remove your admin role first, so FitSphere always has one.
        </p>
      ) : null}
      {error === 'coaching' ? (
        <p role="alert" className="m-0 text-[15px] font-medium text-danger">
          Your coaching still renews each month. Cancel it on{' '}
          <Link href="/coaching" className="underline underline-offset-4">
            Your coaching
          </Link>{' '}
          first, then delete your account.
        </p>
      ) : null}
      {error === 'clients' ? (
        <p role="alert" className="m-0 text-[15px] font-medium text-danger">
          You have paying clients. Their coaching must end before you can delete your account.
        </p>
      ) : null}
      <form action={deleteAccount} className="flex flex-wrap gap-3">
        <Button type="submit" variant="danger">
          Delete my account
        </Button>
        <Link href="/account" className={buttonClass({ variant: 'light' })}>
          Keep my account
        </Link>
      </form>
    </section>
  );
}

// T-ConfirmDelete: deleting needs this screen; the button lives only here.
export default function DeletePage({ searchParams }: PageProps<'/account/delete'>) {
  return (
    <main className="mx-auto flex max-w-xl flex-col px-4 py-16">
      <Suspense fallback={null}>
        <Confirm searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
