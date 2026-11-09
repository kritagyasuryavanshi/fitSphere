import { createDbClient, type DbClient } from '@fitsphere/db';

/** The app's typed database client. It uses the publishable key, so row-level security applies. */
export function db(): DbClient {
  return createDbClient(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '', process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '');
}
