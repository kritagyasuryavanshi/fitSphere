'use server';

import { redirect } from 'next/navigation';
import { signUpUser } from '../guard';
import { AI_NOTES_NOTICE, boxingExperience, boxingWants, equipment, pick, trainingDays, yesNo } from '../options';

export type StepTwoValues = { experience: string; wants: string[]; days: string; equipment: string[]; injuries: string; aiConsent: string };
export type StepTwoState = { values?: StepTwoValues; errors?: { experience?: string; days?: string; injuries?: string; aiConsent?: string; form?: string } };

export async function saveStepTwo(_prev: StepTwoState, formData: FormData): Promise<StepTwoState> {
  const { supabase, sports } = await signUpUser();
  const values: StepTwoValues = {
    experience: String(formData.get('experience') ?? ''),
    wants: formData.getAll('wants').map(String),
    days: String(formData.get('days') ?? ''),
    equipment: formData.getAll('equipment').map(String),
    // Browsers send line breaks as CRLF; count them as one character.
    injuries: String(formData.get('injuries') ?? '').replace(/\r\n/g, '\n'),
    aiConsent: String(formData.get('ai_consent') ?? ''),
  };
  const boxing = sports.includes('boxing');

  const errors: StepTwoState['errors'] = {};
  if (boxing && !pick(boxingExperience, [values.experience]).length) errors.experience = 'Pick your boxing experience';
  if (!pick(trainingDays, [values.days]).length) errors.days = 'Pick how many days a week you can train';
  if (values.injuries.trim().length > 500) errors.injuries = 'Keep this under 500 characters';
  if (!pick(yesNo, [values.aiConsent]).length) errors.aiConsent = 'Choose yes or no';
  if (Object.keys(errors).length) return { values, errors };

  // One call, one transaction: basics, the consent answer and the boxing answers save together or not at all.
  const { error } = await supabase.rpc('save_training_basics', {
    days: Number(values.days),
    equipment: pick(equipment, values.equipment),
    injury_notes: values.injuries,
    ai_consent: values.aiConsent === 'yes',
    notice: AI_NOTES_NOTICE,
    sport_answers: boxing ? { boxing: { experience: values.experience, wants: pick(boxingWants, values.wants) } } : {},
  });
  if (error) return { values, errors: { form: 'We could not save this. Try again.' } };

  redirect(sports.includes('gym') ? '/welcome/3' : '/welcome/4');
}
