# M4-12 Refunds and payout reversal: design

Date: 2026-11-22. Builds on the payment core (M4-09a), renewals (M4-11a) and money-safe deletion (M4-19).
The owner's terms (O-05, MEMORY.md) hold: full refunds only. Coaching is refundable within 7 days of the first payment. Renewals are not refundable. A 1:1 session is refundable up to 24 hours before. An admin can refund by hand.

## Data
- `refunds`: one row per refund. The columns are `payment_id`, `provider_refund_id` (unique), `amount_paise`, `reason` (`first_payment`, `owed_back`, `admin`), `status` (`requested`, `processed`, `failed`), `requested_by`, `note`, `created_at` and `processed_at`.
- A payment has at most one live refund (`requested` or `processed`). A failed refund can be tried again.
- `orders.status` gains `refunded`, and notifications gain the kind `refund_processed`.

## Flow
1. **Request.** The request comes from one of three places:
   - The athlete calls `request_refund(engagement)`, which checks the terms.
   - An admin calls `admin_refund(payment, note)`. The terms do not apply.
   - The daily cron calls `queue_owed_back_refunds()` for every payment marked `duplicate`. That is money owed back, and the no-refund-on-renewals rule does not apply to it.
   - Each request writes `audit_log`.
2. **Send.** The server calls `provider.refund`, then `attach_provider_refund`. The cron resends any requested refund that has no provider id and is older than 10 minutes.
3. **Apply.** The provider sends `refund.processed` or `refund.failed` to `apply_payment_event`, which is still the one writer of money state. The handler finds the refund in this order:
   - by its provider id;
   - else by the payment, for a requested refund that has no provider id yet;
   - else, for a refund made at the provider's dashboard, it writes a new `admin` row.
   - A partial amount, or a second refund for one payment, is ignored and flagged.

## Effects of a processed refund
- The payment becomes `refunded`.
- For a captured payment:
  - The order becomes `refunded`.
  - A payout not yet paid becomes `reversed`.
  - A payout already marked paid stays as it is, and `money_invariants` flags it for an admin.
- For a first payment, the engagement becomes `refunded` and access ends at once. The existing trigger ends the programs the coach assigned. The cron then stops the subscription.
- **Decision (board AC from M4-10):** a refund of a renewal (admin only) sets the engagement to `ended`, not `refunded`. `paid_through` goes back to the day before the refunded month. The earlier months were real coaching, so the client stays in `coach_stats`.
- A refund of a `duplicate` payment changes nothing else.
- The athlete gets a `refund_processed` notification. When coaching ends, both people get an email: `coaching_refunded` or `coaching_ended`.

## 1:1 sessions
Sessions have a date but no time until M4-17. Until then, "24 hours before" means 2 or more days before the session date (India time).

## Out of this PR
- The admin page for payments and refunds moves to M4-18 (the admin queue). `admin_refund` is built and tested here.
- Payout transfers and their reversal at the provider come with Razorpay Route (M4-13).
