import { createDbClient } from '@fitsphere/db';
import type { Viewer } from '@/lib/viewer';
import { supabaseServer } from '@/lib/supabase/server';
import { answerQuestion, healthConsented, profileFor, type Answer, type Model, type Source } from './answer';
import { costMicroUsd, reservationRefusal } from './usage';

/**
 * Answers a signed-in athlete's question. It first takes one of today's questions (the 11th is refused with a clear
 * reply), then reads their profile as them (RLS: their own rows only), retrieves with the service role (the only role
 * allowed to call retrieve_for_ai), and logs the answer with its tokens and cost.
 */
export async function askGuide(viewer: Viewer, question: string, model: Model, limit: number): Promise<Answer> {
  const supabase = await supabaseServer();
  const reserved = await supabase.rpc('reserve_ai_question', { question });
  if (reserved.error) {
    const refusal = reservationRefusal(reserved.error.message, limit);
    if (refusal) return refusal;
    throw reserved.error;
  }
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
  const answer = await answerQuestion(question, profile, {
    model,
    retrieve: async (q) => {
      const { data, error } = await db.rpc('retrieve_for_ai', { question: q, k: 5 });
      if (error) throw error;
      return data as Source[];
    },
  });
  const { usage, ...shown } = answer;
  const logged = await db.rpc('finish_ai_question', {
    question_id: reserved.data,
    answer_kind: shown.kind,
    answer_body: { text: shown.text, citations: shown.citations } as never,
    input_tokens: usage?.input_tokens ?? 0,
    output_tokens: usage?.output_tokens ?? 0,
    cost_micro_usd: costMicroUsd(usage),
  });
  if (logged.error) console.error('finish_ai_question failed', logged.error.code, logged.error.message);
  return shown;
}
