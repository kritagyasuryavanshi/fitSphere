'use server';

import { redirect } from 'next/navigation';
import { isUuid } from '@/lib/programs';
import { supabaseServer } from '@/lib/supabase/server';
import { requireRole } from '@/lib/viewer';

type Step = 'approve' | 'photos' | 'withdraw';

/** M4-15: the client approves the exact version shown, approves its photos separately, or withdraws. */
export async function decideStory(formData: FormData): Promise<void> {
  await requireRole('athlete');
  const engagement = String(formData.get('engagement') ?? '');
  const story = String(formData.get('story') ?? '');
  const step = String(formData.get('step') ?? '') as Step;
  const rev = Number(formData.get('rev'));
  if (!isUuid(engagement) || !isUuid(story) || !['approve', 'photos', 'withdraw'].includes(step)) redirect('/coaching');
  const supabase = await supabaseServer();
  const { error } =
    step === 'withdraw'
      ? await supabase.rpc('withdraw_story', { story })
      : await supabase.rpc(step === 'approve' ? 'approve_story' : 'approve_story_photos', { story, rev: Number.isInteger(rev) ? rev : -1 });
  if (error && !error.message.includes('stale_revision')) console.error('story decision failed', error.message);
  // A newer version arrived meanwhile: the page shows it, to read before approving.
  redirect(`/coaching/${engagement}/story?${error ? (error.message.includes('stale_revision') ? 'error=changed' : 'error=failed') : `done=${step}`}`);
}
