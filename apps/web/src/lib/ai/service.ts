import { createDbClient } from '@fitsphere/db';
import type { Viewer } from '@/lib/viewer';
import { supabaseServer } from '@/lib/supabase/server';
import { answerQuestion, healthConsented, profileFor, type Answer, type Model, type Source } from './answer';

/**
 * Answers a signed-in athlete's question. Their profile is read as them (RLS: their own rows only); retrieval runs
 * with the service role, which is the only role allowed to call retrieve_for_ai.
 */
export async function askGuide(viewer: Viewer, question: string, model: Model): Promise<Answer> {
  const supabase = await supabaseServer();
  const [prefs, basics, consent, notice] = await Promise.all([
    supabase.from('athlete_prefs').select('category_id, answers').eq('user_id', viewer.userId),
    supabase.from('athlete_basics').select('days_per_week, equipment, injury_notes').eq('user_id', viewer.userId).maybeSingle(),
    // The newest choice wins: a later "no" withdraws an earlier "yes".
    supabase.from('consents').select('granted, notice_version').eq('user_id', viewer.userId).eq('purpose', 'ai_health_personalisation').order('created_at', { ascending: false }).limit(1),
    // Consent counts only for the notice in force now, as the account page shows it.
    supabase.from('consent_notices').select('version').eq('purpose', 'ai_health_personalisation').eq('is_current', true).maybeSingle(),
  ]);
  for (const r of [prefs, basics, consent, notice]) if (r.error) throw r.error;
  const profile = profileFor({
    sports: prefs.data!.map((p) => ({ sport: p.category_id, answers: (p.answers ?? {}) as Record<string, unknown> })),
    daysPerWeek: basics.data?.days_per_week ?? null,
    equipment: basics.data?.equipment ?? [],
    injuryNotes: basics.data?.injury_notes ?? '',
    healthConsent: healthConsented(consent.data!, notice.data?.version ?? null),
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
