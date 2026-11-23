'use server';

import { indiaToday, isAdult, parseDob } from '@fitsphere/core';
import { redirect } from 'next/navigation';
import { supabaseServer } from '@/lib/supabase/server';

export type AboutYouValues = { name: string; day: string; month: string; year: string; sports: string[] };
// The typed values go back with the errors, because React resets the form after its action.
export type AboutYouState = { values?: AboutYouValues; errors?: { name?: string; dob?: string; sports?: string; form?: string } };

export async function saveAboutYou(_prev: AboutYouState, formData: FormData): Promise<AboutYouState> {
  const field = (key: string) => String(formData.get(key) ?? '');
  const values: AboutYouValues = { name: field('name'), day: field('day'), month: field('month'), year: field('year'), sports: formData.getAll('sport').map(String) };
  const name = values.name.trim();
  const dob = parseDob(values.day, values.month, values.year);
  const sports = values.sports;

  const errors: AboutYouState['errors'] = {};
  if (!name) errors.name = 'Enter your first name';
  // A date after today is a typo.
  if (!dob || dob > indiaToday()) errors.dob = 'Enter a real date, like 12 06 1998';
  // The beta is 18+ (decision-m6-launch). An under-18 saves nothing; the database refuses it too.
  if (dob && !errors.dob && !isAdult(dob, indiaToday())) redirect('/welcome/under-18');
  if (sports.length === 0) errors.sports = 'Pick at least one sport';
  if (errors.name || errors.dob || errors.sports) return { values, errors };

  const { error } = await (await supabaseServer()).rpc('complete_about_you', { first_name: name, birth_date: dob!, sports });
  if (error?.message === 'under_18') redirect('/welcome/under-18');
  // Invite only during the beta (M6-15); the database decides.
  if (error?.message === 'not_invited') redirect('/welcome/not-invited');
  if (error?.message === 'dob_locked') return { values, errors: { dob: 'Your date of birth is already saved. It cannot be changed.' } };
  if (error?.message === 'sign in first') redirect('/sign-in');
  if (error) return { values, errors: { form: 'We could not save this. Try again.' } };

  redirect('/welcome/2');
}
