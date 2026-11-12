import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { requireRole } from '@/lib/viewer';

// "Download my data": one JSON file of everything personal we hold about the signed-in person (export_my_data).
export async function GET() {
  const viewer = await requireRole('athlete');
  const { data, error } = await (await supabaseServer()).rpc('export_my_data');
  if (error) return NextResponse.json({ error: 'Could not build the download. Try again.' }, { status: 500 });
  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="fitsphere-data-${viewer.userId.slice(0, 8)}.json"`,
      // Personal data: never cached by the browser or anything in between.
      'Cache-Control': 'no-store',
    },
  });
}
