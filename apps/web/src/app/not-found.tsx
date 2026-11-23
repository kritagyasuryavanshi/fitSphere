import { buttonClass } from '@fitsphere/ui';
import type { Metadata } from 'next';
import Link from 'next/link';
import { PublicHeader } from '@/components/layout/headers';
import { ErrorHero } from '@/components/error-hero';

export const metadata: Metadata = { title: 'Not found · FitSphere', robots: { index: false } };

// Every unknown URL and every notFound() call lands here.
export default function NotFound() {
  return (
    <>
      <PublicHeader />
      <ErrorHero eyebrow="Error 404" title="Out of the ring." body="This page does not exist, or the lesson is not published yet.">
        <Link href="/learn" className={buttonClass({ variant: 'volt' })}>
          Browse lessons
        </Link>
        <Link href="/" className={buttonClass({ variant: 'ghost' })}>
          Back to home
        </Link>
      </ErrorHero>
    </>
  );
}
