import { redirect } from 'next/navigation';
import { connection } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { readAccount } from '@/lib/viewer';

/** For sign-up steps 2 to 4: a signed-in user who has finished step 1, with their chosen sports. */
export async function signUpUser() {
  await connection();
  const supabase = await supabaseServer();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims.sub;
  if (!userId) redirect('/sign-in');
  // The sign-up state comes from the shared reader, so every screen agrees on which step is next.
  const [account, prefs] = await Promise.all([
    readAccount(supabase, userId),
    supabase.from('athlete_prefs').select('category_id, answers').eq('user_id', userId),
  ]);
  if (prefs.error) throw new Error(`Could not read the sports: ${prefs.error.message}`);
  if (account.nextStep === '/welcome/1') redirect('/welcome/1');
  const answers = Object.fromEntries((prefs.data ?? []).map((p) => [p.category_id, (p.answers ?? {}) as Record<string, unknown>]));
  return { supabase, userId, name: account.name, roles: account.roles, sports: Object.keys(answers), answers, stepTwoDone: account.nextStep === null };
}
