import { NextResponse, type NextRequest } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';

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
  // A new user has no date of birth yet, so sign-up starts at step 1.
  const { data: profile } = await supabase.from('profiles').select('date_of_birth').eq('id', data.user.id).maybeSingle();
  return NextResponse.redirect(new URL(profile?.date_of_birth ? '/' : '/welcome/1', request.url));
}
