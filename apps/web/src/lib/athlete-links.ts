import type { NavItem } from '@/components/layout/nav-links';

/** The athlete's header and tab links. Ask AI shows only when an AI provider is set (M6-10: hidden in the beta). */
export function athleteLinks(aiOn: boolean): NavItem[] {
  return [
    { href: '/today', label: 'Today', icon: 'calendar' },
    { href: '/learn/boxing', label: 'Learn', icon: 'play' },
    { href: '/progress', label: 'Progress', icon: 'bars' },
    { href: '/coaching', label: 'Coaching', icon: 'calendar' },
    ...(aiOn ? [{ href: '/ask', label: 'Ask AI', icon: 'chat' } satisfies NavItem] : []),
  ];
}
