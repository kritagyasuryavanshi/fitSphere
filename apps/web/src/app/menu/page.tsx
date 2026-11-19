import { buttonClass } from '@fitsphere/ui';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Icon } from '@/components/layout/icons';

export const metadata: Metadata = { title: 'Menu · FitSphere' };

// M-Menu: the visitor menu on phones. A page, not a pop-over, so it needs no script.
// Only pages that exist; the AI guide (M5) adds its own.
const links = [
  { href: '/learn/boxing', label: 'Learn' },
  { href: '/coaches', label: 'Coaches' },
  { href: '/for-coaches', label: 'For coaches' },
  { href: '/legal/privacy', label: 'Privacy' },
  { href: '/legal/terms', label: 'Terms' },
];

export default function MenuPage() {
  return (
    <div className="fixed inset-0 z-20 flex flex-col overflow-y-auto bg-paper">
      <div className="flex items-center justify-between border-b border-line py-2 pl-4 pr-2">
        <Link href="/" className="font-display text-[24px] uppercase">
          FitSphere
        </Link>
        <Link href="/" aria-label="Close menu" className="flex size-11 items-center justify-center">
          <Icon name="close" />
        </Link>
      </div>
      <nav aria-label="Menu" className="flex flex-col px-4 py-2">
        {links.map((link) => (
          <Link key={link.href} href={link.href} className="flex min-h-14 items-center justify-between border-b border-line text-[18px] font-medium">
            {link.label}
            <Icon name="chevron" />
          </Link>
        ))}
      </nav>
      <div className="flex flex-col gap-3 px-4 py-6">
        <Link href="/sign-in" className={buttonClass()}>
          Join free
        </Link>
        <Link href="/sign-in" className={buttonClass({ variant: 'light' })}>
          Log in
        </Link>
      </div>
    </div>
  );
}
