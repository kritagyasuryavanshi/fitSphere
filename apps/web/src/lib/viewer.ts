import type { Database } from '@fitsphere/db';
import { redirect } from 'next/navigation';
import { connection } from 'next/server';
import { cache } from 'react';
import { supabaseServer } from './supabase/server';

export type Role = Database['public']['Enums']['app_role'];
export type Viewer = { userId: string; email: string; name: string; roles: Role[]; signUpDone: boolean };

/** The signed-in person and their roles, read once per request. Null for a guest. */
export const getViewer = cache(async (): Promise<Viewer | null> => {
  await connection();
  const supabase = await supabaseServer();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims.sub;
  if (!userId) return null;
  const [{ data: profile }, { data: roles }] = await Promise.all([
    supabase.from('profiles').select('display_name, date_of_birth').eq('id', userId).maybeSingle(),
    supabase.from('user_roles').select('role').eq('user_id', userId),
  ]);
  return {
    userId,
    email: String(data.claims.email ?? ''),
    name: profile?.display_name ?? '',
    roles: (roles ?? []).map((r) => r.role),
    signUpDone: !!profile?.date_of_birth,
  };
});

/**
 * The server-side guard every protected page calls. Layouts are not enough: Next does not re-run them on navigation.
 * A guest goes to sign-in, an unfinished sign-up goes back to step 1, and a missing role sees the not-allowed page.
 */
export async function requireRole(role: Role): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer) redirect('/sign-in');
  if (!viewer.signUpDone) redirect('/welcome/1');
  if (!viewer.roles.includes(role)) redirect('/not-allowed');
  return viewer;
}

/**
 * Where a person lands after the email link or Google: unfinished sign-up first, then their main screen.
 * Takes the client that just signed in, because the new session cookie is not readable in the same request.
 */
export async function homeAfterSignIn(supabase: Awaited<ReturnType<typeof supabaseServer>>, userId: string): Promise<string> {
  const [{ data: profile }, { data: roles }] = await Promise.all([
    supabase.from('profiles').select('date_of_birth').eq('id', userId).maybeSingle(),
    supabase.from('user_roles').select('role').eq('user_id', userId),
  ]);
  if (!profile?.date_of_birth) return '/welcome/1';
  const has = (role: Role) => (roles ?? []).some((r) => r.role === role);
  return has('athlete') ? '/today' : has('coach') ? '/coach' : '/';
}
