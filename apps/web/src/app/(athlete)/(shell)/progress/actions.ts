'use server';

import { revalidatePath } from 'next/cache';
import { supabaseServer } from '@/lib/supabase/server';
import { requireRole } from '@/lib/viewer';

export type WeightState = { error?: string; saved?: string };

/** Logs today's body weight. 20 to 400 kg with at most one decimal; the database checks it again. */
export async function logWeight(_prev: WeightState, formData: FormData): Promise<WeightState> {
  await requireRole('athlete');
  const raw = String(formData.get('weight') ?? '').trim();
  const value = Number(raw);
  if (!/^\d{2,3}(\.\d)?$/.test(raw) || value < 20 || value > 400) return { error: 'Enter your weight in kg, from 20 to 400, with at most one decimal.' };
  const supabase = await supabaseServer();
  const { error } = await supabase.rpc('log_body_weight', { weight_kg: value });
  if (error) {
    if (error.message.includes('bad_weight')) return { error: 'Enter your weight in kg, from 20 to 400, with at most one decimal.' };
    console.error('log_body_weight failed', error.code, error.message);
    return { error: 'We could not save your weight. Check your connection and try again.' };
  }
  revalidatePath('/progress/gym');
  return { saved: raw };
}
