import Link from 'next/link';

// An id cannot hold spaces: aria-labelledby would read each word as a separate id.
const slug = (title: string) => title.toLowerCase().replace(/[^a-z0-9]+/g, '-');

export type Sections = [string, string[]][];

// Both legal pages. Each stays marked as a draft until M6-02 swaps in the lawyer's text (owner item O-07).
export function LegalPage({ title, updated, sections, other }: { title: string; updated: string; sections: Sections; other: { href: string; label: string } }) {
  return (
    <main className="mx-auto flex w-full max-w-[760px] flex-col gap-6 px-4 pb-20 pt-8 md:px-10">
      <h1 className="m-0 font-display text-[48px] font-normal uppercase leading-[0.95]">{title}</h1>
      <p role="note" className="m-0 border-l-4 border-warning bg-mist px-4 py-3 text-[15px] text-ink-soft">
        Draft for the invite beta. A lawyer is reviewing this text, and we will tell you before any change that affects you.
      </p>
      <p className="m-0 text-[15px] text-muted">Last updated {updated}.</p>
      {sections.map(([heading, items]) => (
        <section key={heading} aria-labelledby={slug(heading)} className="flex flex-col gap-2">
          <h2 id={slug(heading)} className="m-0 text-[20px] font-semibold">
            {heading}
          </h2>
          <ul className="m-0 flex flex-col gap-1.5 pl-5 text-[16px] text-ink-soft">
            {items.map((i) => (
              <li key={i}>{i}</li>
            ))}
          </ul>
        </section>
      ))}
      <p className="m-0 text-[15px] text-muted">
        See also the{' '}
        <Link href={other.href} className="underline">
          {other.label}
        </Link>
        .
      </p>
    </main>
  );
}
