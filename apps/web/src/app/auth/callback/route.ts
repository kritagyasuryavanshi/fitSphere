import { NextResponse, type NextRequest } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';

// The email link and Google both land here with a one-time code. Swap it for a session cookie.
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');
  const supabase = await supabaseServer();
  const { error } = code ? await supabase.auth.exchangeCodeForSession(code) : { error: true };
  return NextResponse.redirect(new URL(error ? '/sign-in?error=link' : '/', request.url));
}
