import type { DbClient } from './index.ts';

// M6-13: the beta opens only with enough real content (docs/plans/remaining-tasks-plan.md). Published, not samples.
// S&C content is mostly kind 'exercise', so drills and exercises both count.
export const CONTENT_GATE = { boxingSkills: 20, scItems: 30 } as const;
export type ContentCounts = { boxingSkills: number; scItems: number };

/** Each count below its minimum, in words; empty when the gate passes. */
export function gateFailures(counts: ContentCounts): string[] {
  const failures: string[] = [];
  if (counts.boxingSkills < CONTENT_GATE.boxingSkills) failures.push(`boxing skills: ${counts.boxingSkills} of ${CONTENT_GATE.boxingSkills}`);
  if (counts.scItems < CONTENT_GATE.scItems) failures.push(`S&C drills and exercises: ${counts.scItems} of ${CONTENT_GATE.scItems}`);
  return failures;
}

/** Counts with the public key: RLS shows only published rows, and only counts leave the database. */
export async function countContent(db: DbClient): Promise<ContentCounts> {
  const count = async (category: string, kinds: ('skill' | 'drill' | 'exercise')[]) => {
    const { count: n, error } = await db
      .from('content_items')
      .select('id, disciplines!inner(category_id)', { count: 'exact', head: true })
      .eq('status', 'published')
      .eq('is_sample', false)
      .eq('disciplines.category_id', category)
      .in('kind', kinds);
    if (error) throw error;
    if (n === null) throw new Error(`No count came back for ${category}.`);
    return n;
  };
  const [boxingSkills, scItems] = await Promise.all([count('boxing', ['skill']), count('sc', ['drill', 'exercise'])]);
  return { boxingSkills, scItems };
}
