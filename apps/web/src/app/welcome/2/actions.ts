'use server';

import { redirect } from 'next/navigation';
import { signUpUser } from '../guard';
import { boxingExperience, boxingWants, equipment, pick, trainingDays } from '../options';

export type StepTwoValues = { experience: string; wants: string[]; days: string; equipment: string[]; injuries: string; aiConsent: boolean };
export type StepTwoState = { values?: StepTwoValues; errors?: { experience?: string; days?: string; injuries?: string; form?: string } };

export async function saveStepTwo(_prev: StepTwoState, formData: FormData): Promise<StepTwoState> {
  const { supabase, sports } = await signUpUser();
  const values: StepTwoValues = {
    experience: String(formData.get('experience') ?? ''),
    wants: formData.getAll('wants').map(String),
    days: String(formData.get('days') ?? ''),
    equipment: formData.getAll('equipment').map(String),
    injuries: String(formData.get('injuries') ?? ''),
    aiConsent: formData.get('ai_consent') === 'yes',
  };
  const boxing = sports.includes('boxing');

  const errors: StepTwoState['errors'] = {};
  if (boxing && !pick(boxingExperience, [values.experience]).length) errors.experience = 'Pick your boxing experience';
  if (!pick(trainingDays, [values.days]).length) errors.days = 'Pick how many days a week you can train';
  if (values.injuries.trim().length > 500) errors.injuries = 'Keep this under 500 characters';
  if (errors.experience || errors.days || errors.injuries) return { values, errors };

  const { error } = await supabase.rpc('save_training_basics', {
    days: Number(values.days),
    equipment: pick(equipment, values.equipment),
    injury_notes: values.injuries,
    ai_consent: values.aiConsent,
  });
  const boxingSave = boxing
    ? await supabase.rpc('save_sport_answers', { category: 'boxing', answers: { experience: values.experience, wants: pick(boxingWants, values.wants) } })
    : { error: null };
  if (error || boxingSave.error) return { values, errors: { form: 'We could not save this. Try again.' } };

  redirect(sports.includes('gym') ? '/welcome/3' : '/welcome/4');
}
