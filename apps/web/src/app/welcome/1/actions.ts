'use server';

import { indiaToday, isAdult, parseDob } from '@fitsphere/core';
import { redirect } from 'next/navigation';
import { supabaseServer } from '@/lib/supabase/server';

export type AboutYouValues = { name: string; day: string; month: string; year: string; sports: string[] };
// The typed values go back with the errors, because React resets the form after its action.
export type AboutYouState = { values?: AboutYouValues; errors?: { name?: string; dob?: string; sports?: string; form?: string } };

async function notEligible(): Promise<never> {
  // Store nothing and end the session, as the A-Under18 screen promises.
  await (await supabaseServer()).auth.signOut();
  redirect('/welcome/not-eligible');
}

export async function saveAboutYou(_prev: AboutYouState, formData: FormData): Promise<AboutYouState> {
  const field = (key: string) => String(formData.get(key) ?? '');
  const values: AboutYouValues = { name: field('name'), day: field('day'), month: field('month'), year: field('year'), sports: formData.getAll('sport').map(String) };
  const name = values.name.trim();
  const dob = parseDob(values.day, values.month, values.year);
  const sports = values.sports;

  const errors: AboutYouState['errors'] = {};
  if (!name) errors.name = 'Enter your first name';
  if (!dob) errors.dob = 'Enter a real date, like 12 06 1998';
  if (sports.length === 0) errors.sports = 'Pick at least one sport';
  if (errors.name || errors.dob || errors.sports) return { values, errors };

  // The server decides on India's date; the database checks the same rule again.
  if (!isAdult(dob!, indiaToday())) await notEligible();

  const { error } = await (await supabaseServer()).rpc('complete_about_you', { first_name: name, birth_date: dob!, sports });
  if (error?.message === 'under_18') await notEligible();
  if (error?.message === 'dob_locked') return { values, errors: { dob: 'Your date of birth is already saved. It cannot be changed.' } };
  if (error?.code === '42501') redirect('/sign-in');
  if (error) return { values, errors: { form: 'We could not save this. Try again.' } };

  // shortcut: step 2 does not exist yet, so finish on the home page; M1-04 sends this to /welcome/2.
  redirect('/');
}
