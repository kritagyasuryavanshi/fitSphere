import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { describe, expect, it } from 'vitest';

// M6-03 route audit: every page and handler becomes a route pattern, and every internal link, redirect or push
// in the source must match one. A link to a page that does not exist fails here, not in front of a user.
const APP = __dirname;
const SRC = join(APP, '..');

function files(dir: string, keep: (name: string) => boolean): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const path = join(dir, e.name);
    return e.isDirectory() ? files(path, keep) : keep(e.name) ? [path] : [];
  });
}

/** '(public)/coaches/[id]/page.tsx' → a regex for '/coaches/<anything>'. Groups vanish; [x] and [...x] match. */
export function routePattern(file: string): RegExp {
  const segs = relative(APP, file).split(sep).slice(0, -1).filter((s) => !/^\(.*\)$/.test(s));
  const body = segs.map((s) => (/^\[\.\.\..+\]$/.test(s) ? '/.+' : /^\[.+\]$/.test(s) ? '/[^/]+' : `/${s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`)).join('');
  return new RegExp(`^${body || '/'}$`);
}

/** Internal targets in a source file: href, redirect, push, replace. A ${…} part stands for one segment. */
export function targets(source: string): string[] {
  const found: string[] = [];
  const re = /(?:href=\{?|redirect\(|\.push\(|\.replace\(|href:\s*)(['"`])(\/[^'"`]*)\1/g;
  for (const m of source.matchAll(re)) found.push(m[2]!);
  return found.map((t) => t.replace(/\$\{[^}]*\}/g, 'x').split(/[?#]/)[0]!.replace(/(.)\/$/, '$1'));
}

const routes = files(APP, (n) => n === 'page.tsx' || n === 'route.ts').map(routePattern);
const sources = files(SRC, (n) => /\.tsx?$/.test(n) && !/\.test\.tsx?$/.test(n));

describe('route audit', () => {
  it('turns files into route patterns', () => {
    expect(routePattern(join(APP, '(public)', 'coaches', '[id]', 'page.tsx')).test('/coaches/abc')).toBe(true);
    expect(routePattern(join(APP, '(public)', 'page.tsx')).test('/')).toBe(true);
    expect(routePattern(join(APP, 'api', 'cron', 'send-emails', 'route.ts')).test('/api/cron/send-emails')).toBe(true);
  });

  it('finds link targets, with ${…} as a segment and the query dropped', () => {
    expect(targets(`<Link href="/learn">a</Link> redirect('/sign-in?next=1'); router.push(\`/coaches/\${id}\`)`)).toEqual(['/learn', '/sign-in', '/coaches/x']);
  });

  it('lists the routes', () => {
    expect(routes.length).toBeGreaterThan(40);
  });

  it('every internal link goes to a route that exists', () => {
    const dead = sources.flatMap((f) =>
      targets(readFileSync(f, 'utf8'))
        .filter((t) => !t.startsWith('/images/') && !t.startsWith('/_next/') && !routes.some((r) => r.test(t)))
        .map((t) => `${relative(SRC, f)}: ${t}`),
    );
    expect(dead).toEqual([]);
  });

  it('has no placeholder link or empty click handler', () => {
    const bad = sources.filter((f) => /href=["']#["']|href=\{["']#["']\}|onClick=\{\(\) => \{\}\}/.test(readFileSync(f, 'utf8')));
    expect(bad.map((f) => relative(SRC, f))).toEqual([]);
  });
});
