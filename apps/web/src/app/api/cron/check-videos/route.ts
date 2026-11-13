import { createDbClient } from '@fitsphere/db';
import { connection } from 'next/server';
import { authorised, videoIsBroken } from '@/lib/video-check';

// Runs once a day (vercel.json). Flags removed or private YouTube videos so authors see them in My lessons.
export async function GET(request: Request) {
  await connection();
  if (!authorised(request.headers.get('authorization'), process.env.CRON_SECRET)) return new Response('Not allowed', { status: 401 });
  // The secret key bypasses RLS; it is used only here, after the cron secret check.
  const db = createDbClient(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '', process.env.SUPABASE_SECRET_KEY ?? '');
  // shortcut: checks up to 500 videos a run; add a checked_at column and rotate past that.
  const { data, error } = await db.from('content_items').select('id, video_id, video_broken').not('video_id', 'is', null).order('updated_at').limit(500);
  if (error) return new Response('Could not read lessons', { status: 500 });
  let checked = 0;
  let changed = 0;
  // Ten at a time, so a full run stays within the function time limit.
  for (let i = 0; i < data.length; i += 10) {
    const batch = data.slice(i, i + 10);
    const results = await Promise.all(batch.map((item) => videoIsBroken(item.video_id!)));
    for (const [j, broken] of results.entries()) {
      if (broken === null) continue;
      checked++;
      if (broken === batch[j].video_broken) continue;
      const { error: updateError } = await db.from('content_items').update({ video_broken: broken }).eq('id', batch[j].id);
      if (!updateError) changed++;
    }
  }
  return Response.json({ checked, changed });
}
