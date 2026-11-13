'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon, type IconName } from './icons';

export type NavItem = { href: string; label: string; icon?: IconName; badge?: number; exact?: boolean };

// A link is current on its own path and below it, so /coach/athletes/1 keeps "Athletes" marked.
// An exact link (like /coach) is current only on its own path, so it does not light up on /coach/clients.
function isCurrent(pathname: string, item: NavItem) {
  return pathname === item.href || (!item.exact && pathname.startsWith(`${item.href}/`));
}

/** The desktop header links. The current one is underlined, as in the mockups. */
export function HeaderLinks({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  return (
    <div className="hidden flex-wrap gap-7 text-[16px] font-medium md:flex">
      {items.map((item) => {
        const current = isCurrent(pathname, item);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={current ? 'page' : undefined}
            className={`inline-flex min-h-11 items-center gap-1.5 ${current ? 'underline underline-offset-[6px]' : ''}`}
          >
            {item.label}
            {item.badge ? <span className="rounded-pill bg-ink px-[7px] py-0.5 text-[12px] text-paper">{item.badge}</span> : null}
          </Link>
        );
      })}
    </div>
  );
}

/** The phone tab bar for athletes and coaches. Hidden on desktop, where the header holds the links. */
export function BottomTabs({ items, label }: { items: NavItem[]; label: string }) {
  const pathname = usePathname();
  return (
    <nav aria-label={label} className="sticky bottom-0 z-10 flex border-t border-line bg-paper px-2 pb-5 pt-1 md:hidden">
      {items.map((item) => {
        const current = isCurrent(pathname, item);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={current ? 'page' : undefined}
            className={`flex min-h-14 flex-1 flex-col items-center justify-center gap-1 text-[12px] ${current ? 'font-semibold text-ink' : 'font-medium text-muted'}`}
          >
            {item.icon ? <Icon name={item.icon} /> : null}
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
