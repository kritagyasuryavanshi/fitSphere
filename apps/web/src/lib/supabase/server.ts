import { createServerClient } from '@supabase/ssr';
import type { Database } from '@fitsphere/db';
import { cookies } from 'next/headers';

/** A Supabase client for server components, server actions and route handlers. The session lives in cookies. */
export async function supabaseServer() {
  const cookieStore = await cookies();
  return createServerClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '', process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '', {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (cookiesToSet) => {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // A server component cannot set cookies. The proxy refreshes the session instead.
        }
      },
    },
  });
}
