import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// Layouts do not re-run on client navigation (Next 16), so each protected page must check the role itself.
const groups = { '(athlete)': 'athlete', '(coach)': 'coach', '(admin)': 'admin' } as const;

function pages(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return pages(path);
    return entry.name === 'page.tsx' ? [path] : [];
  });
}

describe('route guards', () => {
  for (const [group, role] of Object.entries(groups)) {
    const found = pages(join(__dirname, group));

    it(`${group} has pages to guard`, () => {
      expect(found.length).toBeGreaterThan(0);
    });

    for (const page of found) {
      it(`${page.slice(page.indexOf(group))} calls requireRole('${role}')`, () => {
        expect(readFileSync(page, 'utf8')).toContain(`requireRole('${role}')`);
      });
    }
  }
});
