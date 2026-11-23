'use client';

import { Button, buttonClass } from '@fitsphere/ui';
import Link from 'next/link';
import { useEffect } from 'react';
import { ErrorHero } from '@/components/error-hero';

// A page that throws shows this instead of a blank screen. The root layout stays.
export default function ErrorPage({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => console.error(error), [error]);
  return (
    <ErrorHero eyebrow="Something went wrong" title="Take a breather." body="This page did not load. Try again, or go back to the home page.">
      <Button variant="volt" onClick={() => retry()}>
        Try again
      </Button>
      <Link href="/" className={buttonClass({ variant: 'ghost' })}>
        Back to home
      </Link>
    </ErrorHero>
  );
}
