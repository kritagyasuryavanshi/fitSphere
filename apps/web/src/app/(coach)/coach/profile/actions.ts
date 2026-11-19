'use server';

import { revalidatePath } from 'next/cache';
import { COACH_AGREEMENT_VERSION } from '@/lib/coach-agreement';
import { rupeesToPaise } from '@/lib/money';
import { isUuid } from '@/lib/programs';
import { supabaseServer } from '@/lib/supabase/server';
import { requireRole } from '@/lib/viewer';

// fields: what was typed, sent back on an error so the form can refill it (React resets a form after its action).
export type FormState = { error?: string; saved?: string; fields?: Record<string, string> };

const typed = (f: FormData) => Object.fromEntries([...f.entries()].filter(([, v]) => typeof v === 'string').map(([k, v]) => [k, String(v)]));

const list = (v: FormDataEntryValue | null) =>
  String(v ?? '')
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);

const messages: Record<string, string> = {
  bad_profile: 'Check the fields: up to 10 specialties and languages, each up to 40 characters; years 0 to 60; client limit 1 to 100.',
  bad_price: 'Enter a price from ₹0.01 to ₹10,00,000.',
  bad_package: 'Give the package a title and a type.',
  bad_slot: 'Each slot needs a day, a start time and a length, ends by midnight, and does not overlap another slot that day.',
  agreement_needed: 'Accept the coach agreement before you go live.',
  headline_needed: 'Add a headline before you go live.',
  package_needed: 'Add at least one live package before you go live.',
  suspended: 'Your profile is suspended. Contact FitSphere.',
  bad_version: 'The agreement changed. Reload the page and read the new version.',
};
const fail = (e: { message: string; code?: string }, what: string): FormState => {
  const known = Object.keys(messages).find((k) => e.message.includes(k));
  if (!known) console.error(`${what} failed`, e.code, e.message);
  return { error: known ? messages[known] : 'We could not save this. Try again.' };
};

export async function saveProfile(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireRole('coach');
  const supabase = await supabaseServer();
  const { error } = await supabase.rpc('save_coach_profile', {
    headline: String(formData.get('headline') ?? ''),
    philosophy: String(formData.get('philosophy') ?? ''),
    specialties: list(formData.get('specialties')),
    languages: list(formData.get('languages')),
    formats: formData.getAll('formats').map(String),
    city: String(formData.get('city') ?? ''),
    years: Number(formData.get('years') || 0),
    client_limit: Number(formData.get('clientLimit') || 0),
  });
  if (error) return { ...fail(error, 'save_coach_profile'), fields: { ...typed(formData), formats: formData.getAll('formats').join(',') } };
  revalidatePath('/coach/profile');
  return { saved: 'Profile saved.' };
}

export async function savePackage(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireRole('coach');
  const id = String(formData.get('package') ?? '');
  const paise = rupeesToPaise(String(formData.get('price') ?? ''));
  if (paise === null) return { error: messages.bad_price, fields: typed(formData) };
  const supabase = await supabaseServer();
  const { error } = await supabase.rpc('save_package', {
    // null creates a package; the generated type does not know save_package takes null here.
    package: isUuid(id) ? id : (null as unknown as string),
    title: String(formData.get('title') ?? ''),
    kind: String(formData.get('kind') ?? ''),
    price_paise: paise,
    live: formData.get('live') === 'on',
  });
  if (error) return { ...fail(error, 'save_package'), fields: typed(formData) };
  revalidatePath('/coach/profile');
  return { saved: 'Package saved.' };
}

export async function saveSlots(slots: { dow: number; start: string; minutes: number }[]): Promise<FormState> {
  await requireRole('coach');
  const supabase = await supabaseServer();
  const { error } = await supabase.rpc('set_slots', { slots });
  if (error) return fail(error, 'set_slots');
  revalidatePath('/coach/profile');
  return { saved: 'Slots saved.' };
}

export async function acceptAgreement(): Promise<FormState> {
  await requireRole('coach');
  const supabase = await supabaseServer();
  const { error } = await supabase.rpc('accept_coach_agreement', { version: COACH_AGREEMENT_VERSION });
  if (error) return fail(error, 'accept_coach_agreement');
  revalidatePath('/coach/profile');
  return { saved: 'Agreement accepted.' };
}

export async function setLive(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireRole('coach');
  const live = formData.get('live') === 'true';
  const supabase = await supabaseServer();
  const { error } = await supabase.rpc('set_profile_live', { live });
  if (error) return fail(error, 'set_profile_live');
  revalidatePath('/coach/profile');
  return { saved: live ? 'Your profile is live.' : 'Your profile is hidden.' };
}
