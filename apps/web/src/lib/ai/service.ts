import { createDbClient } from '@fitsphere/db';
import type { Viewer } from '@/lib/viewer';
import { supabaseServer } from '@/lib/supabase/server';
import { answerQuestion, profileFor, type Answer, type Model, type Source } from './answer';

/**
 * Answers a signed-in athlete's question. Their profile is read as them (RLS: their own rows only); retrieval runs
 * with the service role, which is the only role allowed to call retrieve_for_ai.
 */
export async function askGuide(viewer: Viewer, question: string, model: Model): Promise<Answer> {
  const supabase = await supabaseServer();
  const [prefs, basics, consent] = await Promise.all([
    supabase.from('athlete_prefs').select('category_id, answers').eq('user_id', viewer.userId),
    supabase.from('athlete_basics').select('days_per_week, equipment, injury_notes').eq('user_id', viewer.userId).maybeSingle(),
    // The newest choice wins: a later "no" withdraws an earlier "yes".
    supabase.from('consents').select('granted').eq('user_id', viewer.userId).eq('purpose', 'ai_health_personalisation').order('created_at', { ascending: false }).limit(1),
  ]);
  for (const r of [prefs, basics, consent]) if (r.error) throw r.error;
  const profile = profileFor({
    sports: prefs.data!.map((p) => ({ sport: p.category_id, answers: (p.answers ?? {}) as Record<string, unknown> })),
    daysPerWeek: basics.data?.days_per_week ?? null,
    equipment: basics.data?.equipment ?? [],
    injuryNotes: basics.data?.injury_notes ?? '',
    healthConsent: consent.data?.[0]?.granted === true,
  });

  const db = createDbClient(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '', process.env.SUPABASE_SECRET_KEY ?? '');
  return answerQuestion(question, profile, {
    model,
    retrieve: async (q) => {
      const { data, error } = await db.rpc('retrieve_for_ai', { question: q, k: 5 });
      if (error) throw error;
      return data as Source[];
    },
  });
}
