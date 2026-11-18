import { notFound } from 'next/navigation';
import { supabaseServer } from './supabase/server';
import type { Viewer } from './viewer';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (v: string) => uuidPattern.test(v);

/** A program the viewer owns, or the not-found page. A failed read throws, so it shows the error page, not a 404. */
export async function ownProgram(id: string, viewer: Viewer) {
  if (!isUuid(id)) notFound();
  const supabase = await supabaseServer();
  const { data, error } = await supabase.from('programs').select('id, title').eq('id', id).eq('coach_id', viewer.userId).maybeSingle();
  if (error) throw error;
  if (!data) notFound();
  return data;
}
