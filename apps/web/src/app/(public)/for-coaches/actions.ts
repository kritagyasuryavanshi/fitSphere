'use server';

import { redirect } from 'next/navigation';
import { supabaseServer } from '@/lib/supabase/server';
import { getViewer } from '@/lib/viewer';

export type ApplyValues = { fullName: string; category: string; city: string; years: string; workUrl: string; howToday: string; terms: boolean };
export type ApplyState = { values?: ApplyValues; errors?: Partial<Record<keyof ApplyValues | 'form', string>> };

const messages: Record<string, string> = {
  already_applied: 'You already have an application waiting. We reply by email.',
  already_coach: 'Your coach tools are already on.',
  unknown_sport: 'Pick what you coach.',
  bad_link: 'Enter a web link that starts with https://',
  bad_years: 'Enter whole years, 0 to 60',
  name_and_city_required: 'Enter your full name and city, up to 80 characters each.',
  too_long: 'Keep your answer under 1,000 characters.',
  recently_declined: 'You can apply again 30 days after your last application was declined.',
};

export async function applyToCoach(_prev: ApplyState, formData: FormData): Promise<ApplyState> {
  // A public page, so no role guard: anyone signed in may apply. The database function checks again.
  const viewer = await getViewer();
  if (!viewer) redirect('/sign-in');
  if (viewer.nextStep) redirect(viewer.nextStep);

  const field = (key: string) => String(formData.get(key) ?? '').trim();
  const values: ApplyValues = {
    fullName: field('full_name'),
    category: field('category'),
    city: field('city'),
    years: field('years'),
    workUrl: field('work_url'),
    howToday: field('how_today').replace(/\r\n/g, '\n'),
    terms: formData.get('terms') === 'yes',
  };

  const errors: ApplyState['errors'] = {};
  if (!values.fullName) errors.fullName = 'Enter your full name';
  if (!values.city) errors.city = 'Enter your city';
  // Same range as the database (0 to 60), so the person sees the field error, not a generic one.
  if (!/^\d{1,2}$/.test(values.years) || Number(values.years) > 60) errors.years = 'Enter whole years, 0 to 60';
  if (values.workUrl && !/^https?:\/\/\S+$/i.test(values.workUrl)) errors.workUrl = messages.bad_link;
  if (values.howToday.length > 1000) errors.howToday = 'Keep this under 1,000 characters';
  if (!values.terms) errors.terms = 'Agree to the terms to apply';
  if (Object.keys(errors).length) return { values, errors };

  const { error } = await (await supabaseServer()).rpc('submit_coach_application', {
    full_name: values.fullName,
    category: values.category,
    city: values.city,
    years: Number(values.years),
    work_url: values.workUrl,
    how_today: values.howToday,
  });
  if (error) return { values, errors: { form: messages[error.message] ?? 'We could not send this. Try again.' } };

  redirect('/for-coaches/applied');
}
