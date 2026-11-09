import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

export type { Database } from './database.types';
export type DbClient = SupabaseClient<Database>;

/** A Supabase client typed from the generated schema. Regenerate the types with `npm run db:types`. */
export function createDbClient(url: string, key: string): DbClient {
  if (!url) throw new Error('Supabase URL is missing.');
  if (!key) throw new Error('Supabase key is missing.');
  return createClient<Database>(url, key);
}
