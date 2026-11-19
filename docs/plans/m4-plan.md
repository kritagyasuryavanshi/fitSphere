# M4 Coach Marketplace: the plan

Written 2026-11-19 by the planner agent (session 13) and checked against the repo. Build it one task at a time: one Feature-track PR per task, not the Batch pipeline. About 75% can be built now against a fake payment provider. Only 09b, 11b, 13b and 16 need a Razorpay account.

**Three design calls carry the plan.**
1. **Access follows `paid_through`.** Coach access ends when time passes, even if a daily job is missed.
2. **One function changes all money state.** `apply_payment_event` makes every change, and the signed webhook is the only source of truth. Duplicates are stopped twice: by the event id and by unique constraints.
3. **Coach payouts are held until the refund window closes.** A refund then reverses a held transfer and never takes money back from a coach's bank.

"Unverified" below means the planner wrote it from its own knowledge of Razorpay, not from the docs. Task 09b checks those claims against the Razorpay docs first.

## 1. Schema

Use one migration per task, with the M3 patterns:
- `revoke all`, then `grant select`, with RLS select policies;
- every write goes through a `security definer` function with `search_path=''`;
- money is `bigint` paise with `check (>= 0)`, and `currency` is `'INR'` only.

**Coaches:**
- **`coach_profiles`**: `coach_id` is the primary key and references profiles. Columns: headline, philosophy, specialties[], languages[], formats[], city, years, `client_limit` (default 10), `agreement_version`, `agreement_accepted_at`, `payout_account_id`, and `status` (draft, live, suspended). The public reads rows with `status = 'live'`.
- **`packages`**: coach_id, title, kind (monthly or single), `price_paise`, and live. The public reads the live packages of live coaches.
- **`availability_slots`**: dow, start_time, minutes, repeating weekly.
- **`credentials`**:
  - Columns: coach_id, title, `file_path` in a private bucket `credentials`, status (pending, checked, rejected), note, `decided_by`, `decided_at`.
  - Only the owner and admins can read the files.
  - The public sees only the title and status, through a view.

**Athletes and coaching:**
- **`shortlists`**: athlete_id and coach_id together are the primary key. Only the owner reads it.
- **`engagements`**: this one table replaces the planned `hire_requests`, so there is one state machine.
  - Columns: athlete_id, coach_id, package_id, snapshots of `price_paise` and `fee_bps`, start_date, goals, `share_data`, `status`, `paid_through`, `cancel_at_period_end`, ended_at.
  - States: `requested → accepted (awaiting payment) → active → cancelling → ended`. The side exits are `declined`, `withdrawn`, `expired`, `lapsed` and `refunded`.
- **`conversations`**: one per athlete and coach pair. **`messages`**: up to 2,000 characters. Only the two people in the conversation read them.
- **`bookings`** (for M4-17): a unique index on (coach_id, starts_at) where status is held or confirmed.

**Money:**
- **`orders`**: engagement_id or booking_id, amount_paise, fee_bps, period_start, period_end, `provider_order_id` (unique), and status (created, paid, expired, failed). A partial unique index on (engagement_id, period_start) where status is created or paid stops duplicate charges.
- **`payments`**: `provider_payment_id` (unique), amount_paise, status (captured, failed, refunded, duplicate), captured_at.
- **`payment_events`**: `provider_event_id` (unique), type, payload, received_at, result (applied, duplicate, ignored, error), note.
- **`subscriptions`**: `provider_subscription_id` (unique), with Razorpay's subscription states.
- **`refunds`**: `provider_refund_id` (unique), amount_paise, reason, status, requested_by.
- **`payouts`**:
  - Columns: payment_id (unique), coach_id, `gross_paise`, `fee_paise`, `net_paise` with `check (net = gross - fee)`, provider_transfer_id, `hold_until`, and status (pending, on_hold, processed, reversed, manual_due, manual_paid).
  - Only the payout's coach and admins read it.

**Reviews and stories:**
- **`reviews`**: one per engagement. Rating 1 to 5, body, hidden_at, `coach_reply`, replied_at. A coach cannot update or delete a review.
- **`client_stories`**: the text the client approved, `photo_consent` stored separately, withdrawn_at.

**How paid coaching extends coach access.**
- A helper `engagement_live(e)` is true when `status in ('active','cancelling') and now() < paid_through`.
- `coach_can_read` keeps its enrollment branch. It gains an `OR`: a live engagement where `coach_id = auth.uid()`, the athlete matches, and `share_data` is true.
- `assign_program` creates an `enrollments` row with a new nullable `engagement_id`.
- `coach_reads_program` and `scheduled_session` gain `and (e.engagement_id is null or engagement_live(e.engagement_id))`.
- The daily sweep ends lapsed engagements and their enrollments.

**Write functions.** Each one locks the row it changes, checks the state it expects, and raises an error on any other state.
- Coach profile: `save_coach_profile`, `save_package`, `set_slots`, `accept_coach_agreement`.
- Credentials: `submit_credential`, and `decide_credential`, which is admin only and writes `audit_log`.
- Engagements: `request_coaching`, `accept_request` (locks `coach_profiles` and checks the client limit), `decline_request`, `withdraw_request`.
- Chat and programs: `send_message`, `assign_program`.
- Billing and reviews: `cancel_coaching`, `request_refund`, `post_review`, `reply_review`.
- Service role only: `start_checkout`, `attach_provider_order`, `apply_payment_event`, `sweep_marketplace`, `money_invariants`.

## 2. Payments

**Provider adapter.** `apps/web/src/lib/payments/` has seven calls: `createOrder`, `createSubscription`, `cancelSubscription`, `refund`, `createTransfer`, `fetchOrder` and `verifyWebhook`.
- It has two versions: `razorpay.ts` (plain HTTP, like `email-send.ts`) and `fake.ts`.
- The fake signs webhooks shaped like Razorpay's.
- A test-only route `/api/test/pay` returns 404 unless `PAYMENTS_PROVIDER=fake`, and it is off in production. A unit test checks that guard.

**Checkout.**
1. `start_checkout` takes the amount from the engagement snapshot only.
2. If an open order already exists for that period, it reuses it.
3. The server stores the provider's order id with `attach_provider_order`.
4. The browser callback only shows "Confirming payment" and polls. It never activates anything.

**Webhook** at `/api/payments/webhook`:
1. Read the raw body with `request.text()`.
2. Check `X-Razorpay-Signature`, an HMAC-SHA256, with `timingSafeEqual`. A mismatch gets 401.
3. Call `apply_payment_event`.
4. Return 200 for applied, duplicate or ignored, and 500 only on a database error, so the provider retries.

The route is exempt from the route guards. Unverified: the event id comes from the `x-razorpay-event-id` header.

**`apply_payment_event`** runs in one transaction:
1. It inserts into `payment_events`. On a conflict it returns duplicate.
2. It applies only the transitions allowed by an explicit table, using `UPDATE … WHERE status = <expected>`. An illegal transition is stored as ignored, with a note.
3. It checks that the amount and currency match the order.
4. A second capture on a paid order becomes a duplicate payment and queues a refund.

| Event | Effect |
|---|---|
| payment captured, or subscription charged | The order becomes paid and the payment is stored. The engagement becomes active and `paid_through` moves to the period end. A payout row is created, and the receipt email is queued. |
| subscription pending | A `payment_due` notification. Access lasts until `paid_through`. |
| subscription halted | The engagement becomes lapsed, and its enrollments end. Both people get an email. |
| refund processed | The refund is processed and the payment is refunded. The engagement becomes refunded and access ends at once. The payout is reversed. |

**Renewal.**
- With "Renew every month" ticked, checkout uses a Razorpay Subscription. Otherwise it creates one Order. 1:1 bookings always use Orders.
- `cancel_coaching` cancels at the end of the paid period and sets `cancelling`. Access lasts until `paid_through`.

**Payouts.**
- The fee is `fee_paise = (gross * fee_bps + 5000) / 10000`, in whole numbers, rounded half up. `net = gross - fee`.
- `fee_bps` is copied onto each order, so a later fee change does not alter past orders.
- With Razorpay Route: after capture, transfer to the coach's linked account, held until the refund window closes.
- Without Route: the payout is `manual_due`, and an admin marks it `manual_paid`.

**Consistency.** `money_invariants()` returns one row per broken rule. pgTAP and the daily sweep both run it, and the sweep emails an admin when anything comes back. The rules:
- an active engagement is covered by a captured payment;
- refunds never exceed the payment;
- `net = gross - fee`;
- no live engagement has a refunded payment;
- each paid order has exactly one captured payment.

**Daily job.** Vercel Hobby allows only 2 cron jobs, so the sweep runs inside the existing `/api/cron/send-emails` job. The sweep:
- expires orders and requests left unpaid for 3 days;
- ends lapsed engagements;
- re-fetches orders still `created` after 30 minutes;
- runs `money_invariants`.

## 3. Task order

N means it can be built now. R means it needs a Razorpay account.

| # | Task | Needs |
|---|---|---|
| 1 | **M4-01** Schema: profiles, packages, slots, credentials, and the private bucket | N |
| 2 | **M4-03** Credentials and admin checks | N |
| 3 | **M4-02** Profile editor, with versioned agreement text (placeholder until the owner provides it) | N |
| 4 | **M4-04** Find a coach | N |
| 5 | **M4-05** Public profile and stats | N |
| 6 | **M4-06** Shortlist and compare | N |
| 7 | **M4-07** Hire, accept and decline, and the client limit (`engagements`) | N |
| 8 | **M4-08** Messages | N |
| 9 | **M4-09a** Payment core: the money tables, `apply_payment_event`, the webhook, checkout and the fake provider | N |
| 10 | **M4-10** Paid coaching opens coach access | N |
| 11 | **M4-11a** Renewal, cancel and failed payments, with a fake subscription | N |
| 12 | **M4-12a** Refunds, using the default terms | N |
| 13 | **M4-13a** Fee maths, the payouts ledger, the earnings page and manual payouts | N |
| 14 | **M4-19 (new)** Money-safe account deletion, suspension and role loss | N |
| 15 | **M4-14** Reviews, **M4-15** client stories, **M4-17** 1:1 booking, **M4-18** reports | N |
| 16 | **M4-20 (new)** A receipts list in Account (gap G5) | N, after its design is approved |
| 17 | **M4-09b** Razorpay Orders in test mode, on a preview | R |
| 18 | **M4-11b** Razorpay Subscriptions | R |
| 19 | **M4-13b** Razorpay Route transfers | R, with Route enabled |
| 20 | **M4-16** Go-live checklist and the M4 milestone check | R, and the owner approves live mode |

## 4. Done criteria

Every task also needs `npm run verify` and its e2e test to pass.

- **01:** Coach A cannot change B's profile, packages or slots. A price check rejects any value that is not whole paise. Only the coach and admins can read files in the credential bucket.
- **03:** The badge shows only after a credential is checked. A reject without a note fails. Each decision writes an `audit_log` row.
- **02:** A coach cannot go live before accepting the agreement. e2e: an edit shows on the public profile.
- **04:** e2e: the price filter shows only coaches in range. Test: the directory exposes no money columns, and its sort keys are fixed.
- **05:** pgTAP: `coach_stats` equals hand-computed values. Anything not checked shows as "self-reported".
- **06:** pgTAP: a shortlist is private. e2e: shortlist two coaches, then compare.
- **07:** pgTAP: a request at the client limit fails; two accepts at once never pass the limit; `share_data` is stored. e2e: request, accept, and the athlete sees Pay.
- **08:** pgTAP: a third person reads 0 messages. e2e: a message appears within 10 seconds, and the off-platform warning shows.
- **09a:**
  - Unit: a bad signature gets 401.
  - pgTAP: a signed-in user cannot run `apply_payment_event`.
  - pgTAP: the same event twice gives one engagement and one payment.
  - pgTAP: an amount mismatch is ignored.
  - pgTAP: a second capture becomes a duplicate and queues a refund.
  - e2e: paying with the fake makes the engagement active.
  - A changed amount in the browser has no effect.
- **10:** pgTAP: coach access ends once `paid_through` is in the past, before any sweep runs. Access also ends on a refund. `assign_program` works only for a live engagement. e2e: the program appears in Today.
- **11a:** pgTAP: after cancel, access lasts until `paid_through`, then stops. A halt makes the engagement lapsed, and each change queues an email. e2e: the cancel flow.
- **12a:** Unit: `refund_quote` follows the written terms. pgTAP: a processed refund makes the engagement refunded and the payout reversed, and writes `audit_log`.
- **13a:** Unit: fee and net are exact to the paisa for ₹4,500, ₹1,200 and ₹999.99. pgTAP: a coach sees only their own payouts, and `money_invariants` returns nothing.
- **19:** pgTAP: deleting an athlete's account keeps orders, payments and refunds, with `athlete_id` set to null. Deletion is blocked while a subscription is active. Suspending a coach cancels their subscriptions.
- **14:** pgTAP: a review needs a paid, finished period, once per engagement. A coach cannot edit a review and gets one reply.
- **17:** pgTAP: a second booking of the same slot fails. A stale hold is released.
- **09b, 11b, 13b:** e2e on a preview with Razorpay test keys and a real test-mode webhook. Check the unverified claims above.
- **16:** All 20 go-live checklist items checked, with evidence. Then the M4 Verify line, Codex, `/code-review high` and `/security-review`.

## 5. Top risks

| Risk | How it is prevented and tested |
|---|---|
| Coach access lasts longer than the payment (R2) | Access follows `paid_through`. A pgTAP test sets the date in the past and checks access is gone. |
| Duplicate or replayed events | The event id and unique constraints. Replay tests, and out-of-order tests (a refund before a capture is ignored). |
| Account deletion destroys payment records or leaves a subscription charging | Task 19. Today deletion cascades from `profiles`. |
| A refund after the coach was paid | Payouts are held until the refund window closes. |
| Racing past the client limit, or two bookings of one slot | Row locks and unique indexes. |
| Missed webhooks | The sweep re-fetches open orders. |
| The fake provider drifts from Razorpay | 09b replays recorded real test-mode payloads. |
| Route or KYC approval comes late (R4) | Manual payouts ship in 13a. |

## 6. Owner decisions, with the defaults used until the owner decides

| Item | Default |
|---|---|
| Provider (O-04) | Razorpay, test mode only |
| Fee (O-05) | 15% (`fee_bps=1500`). FitSphere pays the gateway fee out of its own fee. |
| Client limit | 10 per coach, which the coach can change |
| Refunds | Full refunds only. Coaching: within 7 days of the first payment. No refund on a renewal: cancelling stops the next charge. 1:1 sessions: up to 24 hours before. An admin can refund by hand. |
| Payout timing | Held 7 days, then released |
| Renewal | Razorpay Subscriptions. Fallback: a monthly reminder and a new Order. |
| When a client can review | After at least one completed paid month (this changes M4-14's acceptance criteria) |
| Package changes | Not in v1: cancel and hire again |
| Trials | None |
| Currency | INR only |
| GST (Q-04) | Prices include GST. FitSphere invoices only its fee. An accountant confirms before live. |
| Coach payout accounts | An admin creates the Route account in the Razorpay dashboard and pastes in its id |
| Agreement text | Placeholder until the owner provides it |
| Live mode | Only after task 16 and the owner's approval |
