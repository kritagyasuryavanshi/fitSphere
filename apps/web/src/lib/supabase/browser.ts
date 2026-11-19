'use client';

import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@fitsphere/db';

/** A Supabase client in the browser, with the signed-in user's session from cookies. Used for direct uploads to
 * private Storage buckets, which are too large for a server action; Storage RLS decides what the user may write. */
export function supabaseBrowser() {
  return createBrowserClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '', process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '');
}
