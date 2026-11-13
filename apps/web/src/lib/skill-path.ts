export type SkillStatus = 'done' | 'in_progress' | 'not_started';

/**
 * Orders skills so each comes after its prerequisites. links are [skill, prerequisite] pairs.
 * Ties keep the given order. A cycle cannot block the path: the earliest waiting skill goes next.
 */
export function pathOrder(skills: string[], links: [string, string][]): string[] {
  const inPath = new Set(skills);
  const needs = new Map(skills.map((s) => [s, new Set(links.filter(([a, b]) => a === s && inPath.has(b) && b !== s).map(([, b]) => b))]));
  const out: string[] = [];
  const placed = new Set<string>();
  while (out.length < skills.length) {
    const waiting = skills.filter((s) => !placed.has(s));
    const next = waiting.find((s) => [...needs.get(s)!].every((p) => placed.has(p))) ?? waiting[0];
    out.push(next);
    placed.add(next);
  }
  return out;
}

/** Done once completed. Saving a skill counts as starting it. */
export function skillStatus(slug: string, completed: Set<string>, saved: Set<string>): SkillStatus {
  return completed.has(slug) ? 'done' : saved.has(slug) ? 'in_progress' : 'not_started';
}
