'use server';

import { redirect } from 'next/navigation';
import { signUpUser } from '../guard';
import { AI_METRICS_NOTICE, gymGoals, gymPlaces, liftingExperience, pick, yesNo } from '../options';

export type StepThreeValues = { goal: string; place: string; lifting: string; weight: string; height: string; aiConsent: string };
export type StepThreeState = {
  values?: StepThreeValues;
  errors?: { goal?: string; place?: string; lifting?: string; body?: string; aiConsent?: string; form?: string };
};

// Empty means "not given". Otherwise plain digits with one optional decimal, so "0x48" or "1e2" never pass as a number.
function measure(raw: string, min: number, max: number): number | null | 'bad' {
  const text = raw.trim().replace(',', '.');
  if (!text) return null;
  if (!/^\d{1,3}(\.\d)?$/.test(text)) return 'bad';
  const value = Number(text);
  return value >= min && value <= max ? value : 'bad';
}

export async function saveStepThree(_prev: StepThreeState, formData: FormData): Promise<StepThreeState> {
  const { supabase, sports, stepTwoDone } = await signUpUser();
  if (!stepTwoDone) redirect('/welcome/2');
  if (!sports.includes('gym')) redirect('/welcome/4');
  const field = (key: string) => String(formData.get(key) ?? '');
  const values: StepThreeValues = {
    goal: field('goal'),
    place: field('place'),
    lifting: field('lifting'),
    weight: field('weight'),
    height: field('height'),
    aiConsent: field('ai_consent'),
  };
  const weight = measure(values.weight, 20, 400);
  const height = measure(values.height, 100, 250);

  const errors: StepThreeState['errors'] = {};
  if (!pick(gymGoals, [values.goal]).length) errors.goal = 'Pick your gym goal';
  if (!pick(gymPlaces, [values.place]).length) errors.place = 'Pick where you train';
  if (!pick(liftingExperience, [values.lifting]).length) errors.lifting = 'Pick your lifting experience';
  if (weight === 'bad' || height === 'bad') errors.body = 'Enter weight in kg (20 to 400) and height in cm (100 to 250), or leave them empty';
  if (!pick(yesNo, [values.aiConsent]).length) errors.aiConsent = 'Choose yes or no';
  if (Object.keys(errors).length) return { values, errors };

  // One call, one transaction. Empty fields clear the saved measurement; new values replace it.
  const { error } = await supabase.rpc('save_body_metrics', {
    weight_kg: weight as number,
    height_cm: height as number,
    ai_consent: values.aiConsent === 'yes',
    notice: AI_METRICS_NOTICE,
    sport_answers: { gym: { goal: values.goal, place: values.place, lifting: values.lifting } },
  });
  if (error) return { values, errors: { form: 'We could not save this. Try again.' } };

  redirect('/welcome/4');
}
