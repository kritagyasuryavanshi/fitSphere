'use server';

import { createHash } from 'node:crypto';
import { redirect } from 'next/navigation';
import { isUuid } from '@/lib/programs';
import { supabaseServer } from '@/lib/supabase/server';
import { requireRole } from '@/lib/viewer';

const TYPES: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
const MAX_BYTES = 2 * 1024 * 1024;

/**
 * M4-15: saves a new revision of the coach's story about a client. Each photo is stored under its own SHA-256, so an
 * approved photo can never be swapped; the storage policy refuses overwrites. The database checks the coach, the
 * paid coaching, the text and the photo keys.
 */
export async function saveStory(formData: FormData): Promise<void> {
  await requireRole('coach');
  const engagement = String(formData.get('engagement') ?? '');
  if (!isUuid(engagement)) redirect('/coach/clients');
  const back = (q: string): never => redirect(`/coach/clients/${engagement}/story?${q}`);
  const body = String(formData.get('body') ?? '').slice(0, 2000);
  const files = formData.getAll('photos').filter((f): f is File => f instanceof File && f.size > 0);
  // Keep the photos of the last revision when no new ones are chosen.
  const kept = formData.getAll('keep').map(String).filter((k) => k.startsWith(`stories/${engagement}/`)).slice(0, 3);
  if (files.length > 3) back('error=too_many');
  const supabase = await supabaseServer();
  const keys: string[] = [];
  for (const f of files) {
    const ext = TYPES[f.type];
    if (!ext || f.size > MAX_BYTES) back('error=bad_photo');
    const bytes = Buffer.from(await f.arrayBuffer());
    const key = `stories/${engagement}/${createHash('sha256').update(bytes).digest('hex')}.${ext}`;
    const { error } = await supabase.storage.from('story-photos').upload(key, bytes, { contentType: f.type, upsert: false });
    // The same file uploaded before has the same key, which is fine: it is the same picture.
    if (error && !/exists|duplicate/i.test(error.message)) {
      console.error('story photo upload failed', error.message);
      back('error=upload');
    }
    keys.push(key);
  }
  const { error } = await supabase.rpc('save_story', { engagement, body, photo_keys: files.length ? keys : kept });
  if (error) {
    const code = ['not_paid', 'bad_story', 'bad_photo'].find((c) => error.message.includes(c));
    if (!code) console.error('save_story failed', error.message);
    back(`error=${code ?? 'failed'}`);
  }
  back('saved=1');
}
