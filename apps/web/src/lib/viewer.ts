import type { Database } from '@fitsphere/db';
import { redirect } from 'next/navigation';
import { connection } from 'next/server';
import { cache } from 'react';
import { supabaseServer } from './supabase/server';

export type Role = Database['public']['Enums']['app_role'];
type Client = Awaited<ReturnType<typeof supabaseServer>>;

export type Account = {
  name: string;
  roles: Role[];
  /** The step to finish next, or null once sign-up is done. Step 1 saves the date of birth; step 2 saves the basics. */
  nextStep: '/welcome/1' | '/welcome/2' | null;
};
export type Viewer = Account & { userId: string; email: string };

/**
 * The one place that reads a person's sign-up state and roles. A failed read throws, so the error page shows;
 * it must never look like "no roles" or "sign-up not done".
 */
export async function readAccount(supabase: Client, userId: string): Promise<Account> {
  const [profile, roles, basics] = await Promise.all([
    supabase.from('profiles').select('display_name, date_of_birth').eq('id', userId).maybeSingle(),
    supabase.from('user_roles').select('role').eq('user_id', userId),
    supabase.from('athlete_basics').select('user_id').eq('user_id', userId).maybeSingle(),
  ]);
  const error = profile.error ?? roles.error ?? basics.error;
  if (error) throw new Error(`Could not read the account: ${error.message}`);
  return {
    name: profile.data?.display_name ?? '',
    roles: (roles.data ?? []).map((r) => r.role),
    nextStep: !profile.data?.date_of_birth ? '/welcome/1' : !basics.data ? '/welcome/2' : null,
  };
}

/** The signed-in person and their roles, read once per request. Null for a guest. */
export const getViewer = cache(async (): Promise<Viewer | null> => {
  await connection();
  const supabase = await supabaseServer();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims.sub;
  if (!userId) return null;
  return { userId, email: String(data.claims.email ?? ''), ...(await readAccount(supabase, userId)) };
});

/**
 * The server-side guard. Every page, route handler and server action in a protected group awaits it first
 * (guards.test.ts checks), and passes the returned Viewer to any data it loads. RLS stays the data boundary.
 * A guest goes to sign-in, an unfinished sign-up to its next step, and a missing role to the not-allowed page.
 */
export async function requireRole(role: Role): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer) redirect('/sign-in');
  if (viewer.nextStep) redirect(viewer.nextStep);
  if (!viewer.roles.includes(role)) redirect('/not-allowed');
  return viewer;
}

/** A person's main screen once sign-up is done. Coaches start on their dashboard; "Train" in the coach header and
 * "Coach tools" in the athlete header link the two sides. */
export function homeFor(roles: Role[]): string {
  if (roles.includes('coach')) return '/coach';
  if (roles.includes('athlete')) return '/today';
  if (roles.includes('admin')) return '/admin/people';
  // shortcut: reviewer-only people land on the public home until the review queue exists (M2).
  return '/';
}

/**
 * Where a person lands after signing in. Takes the client that just signed in,
 * because the new session cookie is not readable in the same request.
 */
export async function homeAfterSignIn(supabase: Client, userId: string): Promise<string> {
  const account = await readAccount(supabase, userId);
  return account.nextStep ?? homeFor(account.roles);
}
