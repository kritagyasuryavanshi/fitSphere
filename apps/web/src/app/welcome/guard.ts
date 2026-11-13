import { redirect } from 'next/navigation';
import { connection } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';

/** For sign-up steps 2 to 4: a signed-in user who has finished step 1, with their chosen sports. */
export async function signUpUser() {
  await connection();
  const supabase = await supabaseServer();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims.sub;
  if (!userId) redirect('/sign-in');
  const [{ data: profile }, { data: prefs }, { data: basics }] = await Promise.all([
    supabase.from('profiles').select('display_name, date_of_birth').eq('id', userId).maybeSingle(),
    supabase.from('athlete_prefs').select('category_id, answers').eq('user_id', userId),
    supabase.from('athlete_basics').select('user_id').eq('user_id', userId).maybeSingle(),
  ]);
  if (!profile?.date_of_birth) redirect('/welcome/1');
  const answers = Object.fromEntries((prefs ?? []).map((p) => [p.category_id, (p.answers ?? {}) as Record<string, unknown>]));
  // Step 2 is done once its basics row exists; steps 3 and 4 send the user back to it until then.
  return { supabase, userId, name: profile.display_name, sports: Object.keys(answers), answers, stepTwoDone: !!basics };
}
