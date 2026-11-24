import { createDbClient } from '@fitsphere/db';
import { connection } from 'next/server';
import { isUuid } from '@/lib/programs';

// M4-15: a public story photo. Approval and withdrawal are checked again on every request, then the browser gets a
// 60-second signed link, so a withdrawn photo stops loading within a minute.
export async function GET(_req: Request, { params }: RouteContext<'/api/stories/[id]/photo/[n]'>) {
  await connection();
  const { id, n } = await params;
  const index = Number(n);
  if (!isUuid(id) || !Number.isInteger(index) || index < 0 || index > 2 || !process.env.SUPABASE_SECRET_KEY) return new Response('Not found', { status: 404 });
  const db = createDbClient(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '', process.env.SUPABASE_SECRET_KEY);
  const { data: keys, error } = await db.rpc('story_photo_keys', { story: id });
  const key = keys?.[index];
  if (error || !key) return new Response('Not found', { status: 404 });
  const signed = await db.storage.from('story-photos').createSignedUrl(key, 60);
  if (signed.error) return new Response('Not found', { status: 404 });
  return Response.redirect(signed.data.signedUrl, 302);
}
