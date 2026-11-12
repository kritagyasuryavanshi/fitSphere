import { NextResponse, type NextRequest } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { homeAfterSignIn } from '@/lib/viewer';

// Email links that carry a token_hash (Supabase's server-side pattern) land here. It needs no PKCE cookie,
// so a link opened in another browser still works. The e2e suite also signs users in through it.
type EmailOtpType = 'magiclink' | 'signup' | 'email';
const allowed: EmailOtpType[] = ['magiclink', 'signup', 'email'];

export async function GET(request: NextRequest) {
  const tokenHash = request.nextUrl.searchParams.get('token_hash');
  const type = request.nextUrl.searchParams.get('type') as EmailOtpType | null;
  if (!tokenHash || !type || !allowed.includes(type)) return NextResponse.redirect(new URL('/sign-in?error=link', request.url));

  const supabase = await supabaseServer();
  const { data, error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
  if (error || !data.user) return NextResponse.redirect(new URL('/sign-in?error=link', request.url));
  return NextResponse.redirect(new URL(await homeAfterSignIn(supabase, data.user.id), request.url));
}
