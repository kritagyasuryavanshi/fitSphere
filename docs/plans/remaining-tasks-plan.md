# Plan for the remaining tasks (agreed with Codex, 2026-11-23)

Three rounds with Codex (`gpt-6-luna`), each point checked against the code. Round 3 ended with no open issues.
Status: **approved by the owner on 2026-11-23**, with the four decisions as written. Nothing here is built yet, except where it says so.

## Owner decisions this plan needs
1. **Vercel Pro before taking money.** Vercel's terms limit Hobby to non-commercial use. The free invite beta stays on Hobby. Step 2 needs Pro (about USD 20 a month) or another host.
2. **Monthly renewal by a new Order each month,** not Razorpay Subscriptions. M4-11b is deferred.
3. **Suspension refunds the unused days pro rata.** This is the only partial refund.
4. **The 15% fee is provisional** until a CA's written determination. Earnings show "estimated", and live payouts wait.

## Step 1: invite beta
- **M6-15 (new) Invite-only admission, a release blocker.**
  - Add `beta_invites(email)` (admin only) and `app_settings.signups_open` (default false).
  - `complete_about_you` raises `not_invited` unless sign-ups are open or the email is invited. This covers email and Google, because every account passes step 1.
  - No check before the magic link is sent, because that would show which emails are invited. Turnstile and Supabase limits bound the link sends.
  - The admin adds invites on /admin/people.
  - Tests: pgTAP, plus e2e for an email account and a Google-shaped account.
- **M6-12 Operations.** The branch `m6-12-operations` is rewritten to this design:
  - A private `fitsphere-ops` repo holds `ops.yml` and the encrypted artifacts. Private repos keep scheduled runs alive past 60 quiet days.
  - `/api/health/jobs` needs `CRON_SECRET` and returns only `{ok}`.
  - Restore test: an empty `supabase init` and `start`, then roles, schema and data in one transaction. Every public table count and `auth.users` must match, and `money_invariants()` must return 0 rows.
  - A failed job record shows as overdue within 26 hours.
  - Outbox rows are pruned at 90 days. `claim_emails` already skips unsent rows older than 7 days.
  - Runbook: report to CERT-In within 6 hours now. DPDP breach duties start in May 2027.
- **M6-05 Speed.** A `workflow_dispatch` "perf" job runs Lighthouse three times on a local production build with the seed, mobile preset, and takes the median. Pages: `/`, `/learn/boxing`, and `/today` signed in. Target: 80 or more on each.
- **M6-11 Sign-in gate.**
  - Turnstile on `/sign-in`, with `captchaToken` sent on the OTP call, and captcha switched on in hosted Auth.
  - Hosted settings recorded in `docs/ops/release-gate.md`.
  - A magic link reaches an outside Gmail inbox.
- **S0-08 Errors.** Sentry, errors only. `beforeSend` and `beforeBreadcrumb` strip personal data, and source maps upload from CI only. The metric is "weekly training athletes".
- **M6-13 Content gate.** At least 20 published, non-sample boxing skills, and at least 30 S&C items of kind drill or exercise. It reads with the publishable key and logs only the counts.
- **M6-07 Preview isolation, first.** A second free Supabase project gets synthetic data only. `docs/ops/preview-db.md` covers its pausing.
- **M5-05.** Ask AI stays hidden. A Claude-judged eval is a funded gate before Ask AI opens. Rotate the Gemini key.
- **M6-04.** The owner installs on Android and iOS. This does not block the beta.
- **M6-08 Release gate adds:**
  - M6-15 tested on production;
  - `marketplace_open = false`, with one direct write refused;
  - the owner records the legal posture for step 1a;
  - the runbook and a contact path exist.

## Step 2: marketplace
- **Renewal Orders.** `start_checkout` makes a kind `renewal` order for an `active` engagement:
  - The period starts at `paid_through + 1`.
  - A paid renewal extends `paid_through` with one payment and one payout. Any other paid renewal is money owed back.
  - Reminders go 5 days and 1 day before. A 3-day grace follows, then the coaching lapses.
- **M4-09b Razorpay Orders (test mode, preview project only).**
  - The `x-razorpay-event-id` header is the event id.
  - A late capture is accepted only when all of these hold:
    - the order is `created` or `expired`;
    - the provider and payment order ids match;
    - the amount and currency match;
    - the engagement is in the right state.
  - Otherwise the payment is stored as a duplicate and a refund is queued.
  - Reconciliation: the pay page fetches the order's payments, normalised to a `payment.captured` event with id `reconcile:<payment_id>`. The unique `provider_payment_id` stops a double apply.
- **M4-13 Payouts, manual.**
  - `release_payouts()` locks the payout, payment and refunds, and releases only after `hold_until` with no refund.
  - FitSphere pays the gateway fee and the GST on its own fee out of the fee.
  - A bank reference is required. A failed transfer goes back to `manual_due`.
- **M4-18 Reports and suspension.**
  - **Suspension refund:** the unused days of the paid period, calculated as `floor(price × unused_days / period_days)`. The schema, the refund event check and `money_invariants` change together.
  - **Payout cut:** `net_cut = floor(net × refund / gross)`. If the payout is already `manual_paid`, the cut becomes a `coach_debts` row instead.
  - **Message reports:** the admin sees the reported message and up to 5 messages on each side. Every read is logged.
  - **Report limits:** one open report per reporter and target, and 10 reports a day.
- **M4-16 Go-live.**
  - Each of the 20 items maps to a test, a settings screenshot or a written decision.
  - The kill switch is `marketplace_open = false`.
  - The webhook stays on while any obligation is open.
- **M6-14 Compliance.** A CA gives a written determination: who supplies, registration and TCS, and the documents each party issues. Receipts follow the CA's field list.
- **M6-02.** Processors come from an inventory of the code. Notices are versioned in `consent_notices`, and a material change asks again.
- **M6-08b.**
  - First, a full lifecycle matrix in Razorpay test mode.
  - Then one live payment and one live refund. These need live keys, KYC, the CA, the lawyer and the owner's approval.

## After launch
- **M4-15 Client stories.**
  - Story revisions are immutable, and approval binds to one revision.
  - Photos are separately approved, stored under content-addressed keys with no overwrite, and served by signed URLs that last 60 seconds.
  - Withdrawing hides the story at once.
  - Unapproved and superseded revisions are deleted after 30 days.
- **M4-17 1:1 booking.**
  - Bookings use `timestamptz`, with a gist exclusion constraint against overlap on held and confirmed rows.
  - `reserve_slot` cancels expired holds, and checks that the package's duration fits inside one availability window.
  - A hold lasts 15 minutes. A late capture is refunded.
  - Refunds: 24 hours before the start. The code, the refund screen and the terms change together.

## Already fixed from this review
- PR #71: the refund screen said "24 hours" for sessions. The code enforces 2 days before the session date.
