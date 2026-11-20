import { createDbClient } from '@fitsphere/db';
import type { Viewer } from '@/lib/viewer';
import { supabaseServer } from '@/lib/supabase/server';
import { AI_LABEL, answerQuestion, healthConsented, profileFor, type Answer, type Model, type Source } from './answer';
import { costMicroUsd, reservationRefusal } from './usage';

/**
 * Answers a signed-in athlete's question. It first takes one of today's questions (past the limit, a clear reply),
 * then reads their profile as them (RLS: their own rows only), retrieves with the service role (the only role allowed
 * to call retrieve_for_ai), and logs the answer with its tokens and cost. Whatever fails after the reservation, the
 * question is finished, so nothing stays pending and an unpaid failure gives the question back.
 */
export async function askGuide(viewer: Viewer, question: string, model: Model): Promise<{ id: string | null; answer: Answer }> {
  const supabase = await supabaseServer();
  const reserved = await supabase.rpc('reserve_ai_question', { question });
  if (reserved.error) {
    // The limit in the reply is the one the database enforces.
    const limit = reserved.error.message.includes('ai_daily_limit') ? ((await supabase.rpc('ai_daily_limit')).data ?? 10) : 10;
    const refusal = reservationRefusal(reserved.error.message, limit);
    if (refusal) return { id: null, answer: refusal };
    throw reserved.error;
  }
  const db = createDbClient(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '', process.env.SUPABASE_SECRET_KEY ?? '');
  const finish = async (a: Answer) => {
    const args = {
      question_id: reserved.data,
      answer_kind: a.kind,
      answer_body: { text: a.text, citations: a.citations } as never,
      input_tokens: a.usage?.input_tokens ?? 0,
      output_tokens: a.usage?.output_tokens ?? 0,
      cost_micro_usd: costMicroUsd(a.usage),
    };
    // One retry: a delivered answer must count, and its cost must be logged.
    for (let attempt = 0; attempt < 2; attempt++) {
      const { error } = await db.rpc('finish_ai_question', args);
      if (!error) return;
      console.error('finish_ai_question failed', error.code, error.message);
    }
  };

  let answer: Answer;
  try {
    answer = await answerFor(viewer, question, model, supabase, db);
  } catch (e) {
    await finish({ label: AI_LABEL, kind: 'unavailable', text: '', citations: [] });
    throw e;
  }
  await finish(answer);
  const { usage: _usage, ...shown } = answer;
  void _usage;
  return { id: reserved.data, answer: shown };
}

async function answerFor(viewer: Viewer, question: string, model: Model, supabase: Awaited<ReturnType<typeof supabaseServer>>, db: ReturnType<typeof createDbClient>): Promise<Answer> {
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
  return answerQuestion(question, profile, {
    model,
    retrieve: async (q) => {
      const { data, error } = await db.rpc('retrieve_for_ai', { question: q, k: 5 });
      if (error) throw error;
      return data as Source[];
    },
  });
}
