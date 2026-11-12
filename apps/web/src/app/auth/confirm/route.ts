import { NextResponse, type NextRequest } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { homeAfterSignIn } from '@/lib/viewer';

// Test-only: signs in with an email token_hash, so e2e can sign in admin-made users without sending email.
// Off unless E2E_AUTH_CONFIRM=1 (only Playwright's web server sets it). It has no PKCE binding, so in production
// a link to it would allow login CSRF: someone could sign a victim into the attacker's account.
// To use it for real emails later, put a "Continue" button page in front that POSTs (owner decision).
type EmailOtpType = 'magiclink' | 'signup' | 'email';
const allowed: EmailOtpType[] = ['magiclink', 'signup', 'email'];

export async function GET(request: NextRequest) {
  if (process.env.E2E_AUTH_CONFIRM !== '1') return new NextResponse(null, { status: 404 });
  const tokenHash = request.nextUrl.searchParams.get('token_hash');
  const type = request.nextUrl.searchParams.get('type') as EmailOtpType | null;
  if (!tokenHash || !type || !allowed.includes(type)) return NextResponse.redirect(new URL('/sign-in?error=link', request.url));

  const supabase = await supabaseServer();
  const { data, error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
  if (error || !data.user) return NextResponse.redirect(new URL('/sign-in?error=link', request.url));
  return NextResponse.redirect(new URL(await homeAfterSignIn(supabase, data.user.id), request.url));
}
