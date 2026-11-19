import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { COACH_AGREEMENT, COACH_AGREEMENT_VERSION } from './coach-agreement';

// Coaches accept a version, not a text. These tests fail if the text changes without a new version, or if the app and
// the database disagree on the version, so nobody stays "accepted" under terms they never saw.
const TEXT_OF_VERSION: Record<string, string> = {
  'draft-2026-11': '3b67af067ba37484450ed66009fa6378464bd4442c129bdd88054dda586a2dcc',
};

describe('the coach agreement', () => {
  it('has a new version whenever its text changes', () => {
    const hash = createHash('sha256').update(JSON.stringify(COACH_AGREEMENT)).digest('hex');
    // On a text change: give COACH_AGREEMENT_VERSION a new value, record its hash here, and bump the database too.
    expect(TEXT_OF_VERSION[COACH_AGREEMENT_VERSION], `record the hash ${hash} for version ${COACH_AGREEMENT_VERSION}`).toBe(hash);
  });

  it('has the same version as the database', () => {
    const dir = join(__dirname, '../../../../packages/db/supabase/migrations');
    // The last migration that defines current_coach_agreement decides the database's version.
    const latest = readdirSync(dir)
      .filter((f) => f.endsWith('.sql'))
      .sort()
      .map((f) => readFileSync(join(dir, f), 'utf8'))
      .filter((sql) => /function public\.current_coach_agreement\(\)/.test(sql))
      .at(-1)!;
    expect(/select '([^']+)'::text;/.exec(latest.slice(latest.indexOf('current_coach_agreement')))?.[1]).toBe(COACH_AGREEMENT_VERSION);
  });
});
