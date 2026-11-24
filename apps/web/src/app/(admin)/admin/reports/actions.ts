'use server';

import { redirect } from 'next/navigation';
import { isUuid } from '@/lib/programs';
import { supabaseServer } from '@/lib/supabase/server';
import { requireRole } from '@/lib/viewer';

function done(error: { message: string } | null, ok: string): never {
  if (error) console.error('report action failed', error.message);
  redirect(`/admin/reports?${error ? 'error=1' : `done=${ok}`}`);
}

/** M4-18: dismiss or resolve a report. */
export async function resolveReport(formData: FormData): Promise<void> {
  await requireRole('admin');
  const report = String(formData.get('report') ?? '');
  const outcome = String(formData.get('outcome') ?? '');
  if (!isUuid(report) || !['resolved', 'dismissed'].includes(outcome)) redirect('/admin/reports');
  const { error } = await (await supabaseServer()).rpc('admin_resolve_report', { report, outcome });
  done(error, outcome);
}

/** M4-18: hide a reported review from the profile and the rating. */
export async function hideReview(formData: FormData): Promise<void> {
  await requireRole('admin');
  const review = String(formData.get('review') ?? '');
  if (!isUuid(review)) redirect('/admin/reports');
  const { error } = await (await supabaseServer()).rpc('admin_hide_review', { review });
  done(error, 'hidden');
}

/** M4-18: suspend a coach. Their running coaching ends today and the unused days are refunded by the daily cron. */
export async function suspendCoach(formData: FormData): Promise<void> {
  await requireRole('admin');
  const coach = String(formData.get('coach') ?? '');
  const why = String(formData.get('why') ?? '').slice(0, 500);
  if (!isUuid(coach)) redirect('/admin/reports');
  const { error } = await (await supabaseServer()).rpc('admin_suspend_coach', { coach, why });
  done(error, 'suspended');
}
