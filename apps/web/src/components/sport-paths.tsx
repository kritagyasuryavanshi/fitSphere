import Link from 'next/link';
import { itemNoun } from '@/lib/content';
import { sportPitch } from '@/lib/sports';

export type SportPath = { id: string; name: string; tagline: string; count: number };

/** One equal card per live sport, with its real lesson count, and the sports still to come named as planned. */
export function SportPaths({ paths, planned }: { paths: SportPath[]; planned: string[] }) {
  return (
    <div className="flex flex-col gap-4">
      <ul className="m-0 grid list-none gap-4 p-0 md:grid-cols-3">
        {paths.map((p) => (
          <li key={p.id}>
            <Link href={`/learn/${p.id}`} className="flex h-full flex-col gap-3 border-2 border-ink p-6 hover:bg-mist">
              <span className="font-display text-[32px] uppercase leading-none md:text-[40px]">{p.name}</span>
              <span className="text-[16px] leading-[1.5] text-ink-soft">{sportPitch[p.id] ?? p.tagline}</span>
              <span className="mt-auto pt-2 text-[15px] font-medium underline underline-offset-4">
                {p.count ? `${p.count} ${itemNoun(p.id, p.count)}` : 'Open the library'}
              </span>
            </Link>
          </li>
        ))}
      </ul>
      {planned.length ? <p className="m-0 text-[14px] text-muted">Planned, not on FitSphere yet: {planned.join(', ')}.</p> : null}
    </div>
  );
}
