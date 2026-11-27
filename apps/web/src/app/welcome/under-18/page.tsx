import { buttonClass } from '@fitsphere/ui';
import type { Metadata } from 'next';
import Link from 'next/link';
import { AuthHeading, AuthShell } from '../../auth-shell';

export const metadata: Metadata = { title: '18+ for now · FitSphere' };

// Step 1 sends an under-18 here and saves nothing (decision-m6-launch). Static: it reads no session.
export default function UnderEighteenPage() {
  return (
    <AuthShell back={{ href: '/welcome/1', label: 'Back' }} slogan="See you soon.">
      <AuthHeading>FitSphere is 18+ for now</AuthHeading>
      <p className="m-0 max-w-[62ch] text-[16px] leading-[1.6] text-ink-soft">
        During the beta, you must be 18 or older to use FitSphere. We did not save your date of birth or anything else from that step.
      </p>
      <p className="m-0 max-w-[62ch] text-[16px] leading-[1.6] text-ink-soft">
        We plan to welcome under-18s later, with a parent’s consent. Your account holds only your email address. You can delete it now.
      </p>
      <Link href="/account/delete" className={buttonClass()}>
        Delete my account
      </Link>
      <Link href="/welcome/1" className={buttonClass({ variant: 'ghost' })}>
        I typed the wrong date
      </Link>
    </AuthShell>
  );
}
