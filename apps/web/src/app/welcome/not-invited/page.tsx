import { buttonClass } from '@fitsphere/ui';
import type { Metadata } from 'next';
import Link from 'next/link';
import { AuthHeading, AuthShell } from '../../auth-shell';

export const metadata: Metadata = { title: 'Invite only for now · FitSphere' };

// Step 1 sends someone without an invite here and saves nothing (M6-15). Static: it reads no session.
export default function NotInvitedPage() {
  return (
    <AuthShell back={{ href: '/', label: 'Home' }} photo={{ src: '/images/gloves-black.jpg', alt: 'Black boxing gloves hanging in a gym' }} slogan="See you soon.">
      <AuthHeading>FitSphere is invite only for now</AuthHeading>
      <p className="m-0 max-w-[62ch] text-[16px] leading-[1.6] text-ink-soft">
        The beta is open to invited people only. Your email address is not on the list yet. We did not save anything from that step.
      </p>
      <p className="m-0 max-w-[62ch] text-[16px] leading-[1.6] text-ink-soft">
        If someone invited you, ask them to check the address they used. Your account holds only your email address. You can delete it now.
      </p>
      <Link href="/account/delete" className={buttonClass()}>
        Delete my account
      </Link>
      <Link href="/learn/boxing" className={buttonClass({ variant: 'ghost' })}>
        Browse lessons
      </Link>
    </AuthShell>
  );
}
