import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// Layouts do not re-run on client navigation (Next 16), and they never guard route handlers or server actions.
// So every page, route handler and server-action file in a protected group must call the role guard itself.
const groups = { '(athlete)': 'athlete', '(coach)': 'coach', '(admin)': 'admin' } as const;

function entryFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return entryFiles(path);
    if (['page.tsx', 'route.ts'].includes(entry.name)) return [path];
    // Any file that starts with 'use server' is reachable by a direct POST.
    return /\.tsx?$/.test(entry.name) && /^\s*['"]use server['"]/.test(readFileSync(path, 'utf8')) ? [path] : [];
  });
}

// A guard in a comment is no guard.
function code(path: string) {
  return readFileSync(path, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

describe('route guards', () => {
  it('does not count a guard that is only in a comment', () => {
    expect("// await requireRole('coach')\nexport default 1;".replace(/(^|[^:])\/\/.*$/gm, '$1')).not.toContain('requireRole');
  });

  for (const [group, role] of Object.entries(groups)) {
    const found = entryFiles(join(__dirname, group));

    it(`${group} has entry points to guard`, () => {
      expect(found.length).toBeGreaterThan(0);
    });

    for (const file of found) {
      it(`${file.slice(file.indexOf(group))} awaits requireRole('${role}')`, () => {
        expect(code(file)).toContain(`await requireRole('${role}')`);
      });
    }
  }
});
