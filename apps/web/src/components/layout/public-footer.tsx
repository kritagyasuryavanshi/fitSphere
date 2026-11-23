import Link from 'next/link';

// The public site footer (C-Landing). Only pages that exist.
const columns: [string, [string, string][]][] = [
  ['Learn', [['/learn/boxing', 'Boxing'], ['/learn/sc', 'Strength & Conditioning'], ['/learn/gym', 'Gym & Fitness'], ['/programs', 'Programs']]],
  ['FitSphere', [['/about', 'About'], ['/coaches', 'Coaches'], ['/for-coaches', 'For coaches'], ['/help', 'Help']]],
  ['Legal', [['/legal/privacy', 'Privacy policy'], ['/legal/terms', 'Terms of use']]],
];

export function PublicFooter() {
  return (
    <footer className="border-t border-line-strong">
      <div className="mx-auto flex w-full max-w-[1440px] flex-wrap gap-12 px-4 py-10 md:px-10">
        {columns.map(([title, links]) => (
          <nav key={title} aria-label={title} className="flex flex-col gap-3 text-[14px] font-medium">
            <span>{title}</span>
            {links.map(([href, label]) => (
              <Link key={href} href={href} className="text-muted hover:text-ink">
                {label}
              </Link>
            ))}
          </nav>
        ))}
      </div>
    </footer>
  );
}
