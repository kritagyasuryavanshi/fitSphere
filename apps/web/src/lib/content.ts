import { supabaseServer } from './supabase/server';

export const facetKeys = ['discipline', 'level', 'equipment', 'environments', 'drill_type', 'supports'] as const;
export type FacetKey = (typeof facetKeys)[number];
export type Filters = Partial<Record<FacetKey, string[]>>;
export type Facetable = { discipline: string; level: string; equipment: string[]; environments: string[]; drill_type: string | null; supports: string[] };

/** Filters from the URL. Unknown keys and values that are not slugs are dropped. */
export function parseFilters(params: Record<string, string | string[] | undefined>): Filters {
  const out: Filters = {};
  for (const key of facetKeys) {
    const raw = params[key];
    const values = (Array.isArray(raw) ? raw : raw ? [raw] : []).flatMap((v) => v.split(',')).filter((v) => /^[a-z0-9_-]{1,40}$/.test(v));
    if (values.length) out[key] = [...new Set(values)];
  }
  return out;
}

/** The values an item has for one filter. No equipment counts as "none". */
export function valuesOf(item: Facetable, key: FacetKey): string[] {
  if (key === 'equipment') return item.equipment.length ? item.equipment : ['none'];
  const v = item[key];
  return Array.isArray(v) ? v : v ? [v] : [];
}

/** An item matches when it has one of the chosen values in every chosen filter. */
export function matches(item: Facetable, filters: Filters): boolean {
  return facetKeys.every((key) => !filters[key]?.length || valuesOf(item, key).some((v) => filters[key]!.includes(v)));
}

export function humanise(slug: string): string {
  const words = slug.replace(/[_-]+/g, ' ').trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

// The words each category uses on screen. A new category falls back to the defaults (decision D5).
const words: Record<string, { discipline?: string; level?: Record<string, string>; item?: [string, string] }> = {
  boxing: { item: ['lesson', 'lessons'] },
  sc: { discipline: 'Type', item: ['exercise', 'exercises'] },
  gym: { discipline: 'Muscle group', level: { beginner: 'New to lifting', intermediate: 'Some experience', advanced: 'Advanced' }, item: ['exercise', 'exercises'] },
};
export const facetLegend: Record<FacetKey, string> = {
  discipline: 'Discipline',
  level: 'Level',
  equipment: 'Equipment',
  environments: 'Where you train',
  drill_type: 'Type',
  supports: 'Builds this boxing skill',
};
export function legendFor(category: string, key: FacetKey) {
  return (key === 'discipline' && words[category]?.discipline) || facetLegend[key];
}
export function levelLabel(category: string, level: string) {
  return words[category]?.level?.[level] ?? humanise(level);
}
export function itemNoun(category: string, count: number) {
  const [one, many] = words[category]?.item ?? ['item', 'items'];
  return count === 1 ? one : many;
}

export type LibraryItem = Facetable & {
  slug: string;
  title: string;
  kind: string;
  durationMin: number | null;
  isSample: boolean;
  authorName: string | null;
  muscles: string[];
};

/** Published items of one category, in discipline order. RLS returns only published rows to the public. */
export async function libraryItems(category: string): Promise<LibraryItem[]> {
  const supabase = await supabaseServer();
  // shortcut: loads the whole category and filters in memory; move filters into SQL past a few hundred items per category.
  const { data, error } = await supabase
    .from('content_items')
    .select('slug, title, kind, level, duration_min, equipment, environments, drill_type, supports, is_sample, author_id, disciplines!inner(slug, sort, category_id), content_muscles(muscle_id, is_primary, muscles(name))')
    .eq('status', 'published')
    .eq('disciplines.category_id', category)
    .order('title');
  if (error) throw error;
  const names = await authorNames(data.map((d) => d.author_id));
  return data
    .sort((a, b) => a.disciplines.sort - b.disciplines.sort)
    .map((d) => ({
      slug: d.slug,
      title: d.title,
      kind: d.kind,
      level: d.level,
      durationMin: d.duration_min,
      equipment: d.equipment,
      environments: d.environments,
      drill_type: d.drill_type,
      supports: d.supports,
      discipline: d.disciplines.slug,
      isSample: d.is_sample,
      authorName: d.author_id ? (names.get(d.author_id) ?? null) : null,
      muscles: d.content_muscles.sort((x, y) => Number(y.is_primary) - Number(x.is_primary)).map((m) => m.muscles.name),
    }));
}

/** Display names of the authors of published items; profiles are not public otherwise. */
export async function authorNames(ids: (string | null)[]): Promise<Map<string, string>> {
  const wanted = [...new Set(ids.filter((id): id is string => !!id))];
  if (!wanted.length) return new Map();
  const supabase = await supabaseServer();
  const { data, error } = await supabase.rpc('author_names', { ids: wanted });
  if (error) throw error;
  return new Map(data.map((r) => [r.id, r.display_name]));
}
