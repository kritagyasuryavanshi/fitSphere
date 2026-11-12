'use server';

import { redirect } from 'next/navigation';
import { signUpUser } from '../guard';
import { gymGoals, gymPlaces, liftingExperience, pick } from '../options';

export type StepThreeValues = { goal: string; place: string; lifting: string; weight: string; height: string };
export type StepThreeState = { values?: StepThreeValues; errors?: { goal?: string; place?: string; lifting?: string; body?: string; form?: string } };

// Empty means "not given"; anything else must be a number in range.
function measure(raw: string, min: number, max: number): number | null | 'bad' {
  const text = raw.trim().replace(',', '.');
  if (!text) return null;
  const value = Number(text);
  return Number.isFinite(value) && value >= min && value <= max ? Math.round(value * 10) / 10 : 'bad';
}

export async function saveStepThree(_prev: StepThreeState, formData: FormData): Promise<StepThreeState> {
  const { supabase, userId, sports } = await signUpUser();
  if (!sports.includes('gym')) redirect('/welcome/4');
  const field = (key: string) => String(formData.get(key) ?? '');
  const values: StepThreeValues = { goal: field('goal'), place: field('place'), lifting: field('lifting'), weight: field('weight'), height: field('height') };
  const weight = measure(values.weight, 20, 400);
  const height = measure(values.height, 100, 250);

  const errors: StepThreeState['errors'] = {};
  if (!pick(gymGoals, [values.goal]).length) errors.goal = 'Pick your gym goal';
  if (!pick(gymPlaces, [values.place]).length) errors.place = 'Pick where you train';
  if (!pick(liftingExperience, [values.lifting]).length) errors.lifting = 'Pick your lifting experience';
  if (weight === 'bad' || height === 'bad') errors.body = 'Enter weight in kg (20 to 400) and height in cm (100 to 250), or leave them empty';
  if (Object.keys(errors).length) return { values, errors };

  const { error } = await supabase.rpc('save_sport_answers', {
    category: 'gym',
    answers: { goal: values.goal, place: values.place, lifting: values.lifting },
  });
  // Weight and height are optional. A row is logged only when one is given and it differs from the last log,
  // so going back through sign-up does not add duplicate measurements.
  const { data: last } = await supabase.from('body_metrics').select('weight_kg, height_cm').eq('user_id', userId).order('measured_at', { ascending: false }).limit(1).maybeSingle();
  const changed = weight !== (last?.weight_kg ?? null) || height !== (last?.height_cm ?? null);
  const metrics =
    (weight !== null || height !== null) && changed
      ? await supabase.rpc('log_body_metrics', { weight_kg: weight as number, height_cm: height as number })
      : { error: null };
  if (error || metrics.error) return { values, errors: { form: 'We could not save this. Try again.' } };

  redirect('/welcome/4');
}
