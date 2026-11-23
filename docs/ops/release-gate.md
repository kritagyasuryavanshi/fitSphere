# Sign-in release gate (M6-11)

Record each hosted setting with a screenshot or the copied value, and the date checked. Local `config.toml` proves nothing about production.

| Setting | Where | Value to set | Checked |
|---|---|---|---|
| Confirm email | Supabase → Authentication → Sign In / Providers → Email | On | |
| Custom SMTP | Supabase → Authentication → Emails → SMTP | Resend, from an address on our domain | |
| Site URL | Supabase → Authentication → URL Configuration | `https://<our domain>` | |
| Redirect allow-list | same page | only `https://<our domain>/**` (and the Vercel production URL until the domain switch) | |
| Rate limits | Supabase → Authentication → Rate Limits | email sends per hour and OTP verifications at the defaults or lower | |
| Captcha | Supabase → Authentication → Attack Protection | Turnstile on, with the Turnstile secret key | |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Vercel → Environment Variables (Production) | the Turnstile site key | |
| `NEXT_PUBLIC_SITE_URL` | Vercel → Environment Variables (Production) | `https://<our domain>` | |

Tests on production after the settings:
1. A magic link reaches an outside Gmail inbox, and signs in.
2. A link request without the Turnstile check is refused. In the browser devtools, delete the `cf-turnstile-response` field before sending, and expect "Complete the check above the button".
3. An uninvited address cannot finish sign-up step 1 (M6-15).
