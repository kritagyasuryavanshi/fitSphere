import { buttonClass } from '@fitsphere/ui';
import type { Metadata } from 'next';
import Link from 'next/link';
import { AuthHeading, AuthShell } from '../../auth-shell';

export const metadata: Metadata = { title: 'For adults, for now · FitSphere' };

export default function NotEligiblePage() {
  return (
    <AuthShell back={{ href: '/', label: 'Back' }} photo={{ src: '/images/stance.jpg', alt: 'Boxer in stance wearing gloves' }} slogan="Not yet.">
      <AuthHeading>FitSphere is for adults, for now</AuthHeading>
      <p className="m-0 max-w-[62ch] text-[16px] leading-[1.6] text-ink-soft">
        You need to be 18 or over to make an account. We are building a version for young athletes that needs a parent’s consent first.
      </p>
      <p className="m-0 text-[16px] font-medium">We did not save anything you typed.</p>
      <div className="flex flex-wrap gap-3">
        {/* shortcut: the free library arrives in M2-03; until then both links go home. */}
        <Link href="/" className={buttonClass()}>
          Back to home
        </Link>
      </div>
    </AuthShell>
  );
}
