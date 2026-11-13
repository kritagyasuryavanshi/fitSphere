'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { youtubeId } from '@/lib/lesson-draft';
import { supabaseServer } from '@/lib/supabase/server';
import { requireRole } from '@/lib/viewer';

export type LessonState = { error?: string; field?: string };

const uuid = /^[0-9a-f-]{36}$/;
const levels = ['beginner', 'intermediate', 'advanced'] as const;
const kinds = ['skill', 'drill', 'exercise'] as const;
// Free-text tags become slugs: "Heavy bag" -> heavy_bag.
const tags = (v: FormDataEntryValue | null) =>
  String(v ?? '')
    .split(',')
    .map((t) => t.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40))
    .filter(Boolean);

const messages: Record<string, [string, string]> = {
  title_required: ['Give the lesson a title.', 'title'],
  bad_tag: ['Use short words for equipment and skills, separated by commas.', 'equipment'],
  incomplete: ['Add a public video, 3 steps, mistakes and safety before you submit.', 'safety'],
  not_editable: ['This lesson is in review or live, so it cannot change now.', ''],
};

/** Save draft or Submit for review. The database checks ownership and completeness again. */
export async function saveLesson(_prev: LessonState, formData: FormData): Promise<LessonState> {
  await requireRole('coach');
  const id = String(formData.get('id') ?? '');
  const discipline = String(formData.get('discipline') ?? '');
  const kind = kinds.find((k) => k === formData.get('kind')) ?? 'skill';
  const level = levels.find((l) => l === formData.get('level')) ?? 'beginner';
  const link = String(formData.get('video') ?? '').trim();
  const videoId = link ? youtubeId(link) : null;
  if (link && !videoId) return { error: 'This is not a YouTube link. Paste the link from the Share button.', field: 'video' };
  if (!uuid.test(discipline)) return { error: 'Choose a discipline.', field: 'discipline' };
  const minutes = Number(formData.get('duration') || 0);

  const supabase = await supabaseServer();
  const { data: saved, error } = await supabase.rpc('save_content_draft', {
    item: uuid.test(id) ? id : (null as unknown as string),
    discipline,
    kind,
    title: String(formData.get('title') ?? ''),
    summary: String(formData.get('summary') ?? ''),
    level,
    duration_min: Number.isInteger(minutes) && minutes >= 1 && minutes <= 240 ? minutes : (null as unknown as number),
    equipment: tags(formData.get('equipment')),
    supports: tags(formData.get('supports')),
    video_id: videoId as string,
    mistakes: String(formData.get('mistakes') ?? ''),
    safety: String(formData.get('safety') ?? ''),
    steps: formData.getAll('step').map(String),
    muscles: formData.getAll('muscle').map(String),
    prerequisites: formData.getAll('learn_first').map(String).filter((v) => uuid.test(v)),
  });
  const known = (e: { message: string }) => Object.keys(messages).find((k) => e.message.includes(k));
  if (error) {
    if (!known(error)) console.error('save_content_draft failed', error.code, error.message);
    const [message, field] = messages[known(error) ?? ''] ?? ['We could not save this. Try again.', ''];
    return { error: message, field };
  }
  if (formData.get('intent') === 'submit') {
    const { error: submitError } = await supabase.rpc('submit_content', { item: saved });
    if (submitError) {
      const [message, field] = messages[known(submitError) ?? ''] ?? ['We could not submit this. Try again.', ''];
      return { error: message, field };
    }
    revalidatePath('/coach/lessons');
    redirect('/coach/lessons?submitted=1');
  }
  revalidatePath('/coach/lessons');
  redirect(`/coach/lessons/${saved}?saved=1`);
}
