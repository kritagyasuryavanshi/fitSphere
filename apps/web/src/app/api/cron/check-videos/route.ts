import { createDbClient } from '@fitsphere/db';
import { connection } from 'next/server';
import { authorised, videoIsBroken } from '@/lib/video-check';

// Runs once a day (vercel.json). Flags removed or private YouTube videos so authors see them in My lessons.
export async function GET(request: Request) {
  await connection();
  if (!authorised(request.headers.get('authorization'), process.env.CRON_SECRET)) return new Response('Not allowed', { status: 401 });
  // The secret key bypasses RLS; it is used only here, after the cron secret check.
  const db = createDbClient(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '', process.env.SUPABASE_SECRET_KEY ?? '');
  // shortcut: checks up to 500 videos a run, one at a time; batch or queue them past a few hundred lessons.
  const { data, error } = await db.from('content_items').select('id, video_id, video_broken').not('video_id', 'is', null).order('updated_at').limit(500);
  if (error) return new Response('Could not read lessons', { status: 500 });
  let checked = 0;
  let changed = 0;
  for (const item of data) {
    const broken = await videoIsBroken(item.video_id!);
    if (broken === null) continue;
    checked++;
    if (broken !== item.video_broken) {
      const { error: updateError } = await db.from('content_items').update({ video_broken: broken }).eq('id', item.id);
      if (!updateError) changed++;
    }
  }
  return Response.json({ checked, changed });
}
