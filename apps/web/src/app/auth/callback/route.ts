import { NextResponse, type NextRequest } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { homeAfterSignIn } from '@/lib/viewer';

// The email link and Google both land here with a one-time code. Swap it for a session cookie.
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const code = params.get('code');
  if (!code) {
    // Supabase sends an error instead of a code. An expired email link says otp_expired; anything else came from Google.
    const kind = !params.get('error') || params.get('error_code') === 'otp_expired' ? 'link' : 'google';
    return NextResponse.redirect(new URL(`/sign-in?error=${kind}`, request.url));
  }
  const supabase = await supabaseServer();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return NextResponse.redirect(new URL('/sign-in?error=link', request.url));
  return NextResponse.redirect(new URL(await homeAfterSignIn(supabase, data.user.id), request.url));
}
