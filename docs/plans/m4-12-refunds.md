# M4-12 Refunds and payout reversal: design

Date: 2026-11-22. This builds on the payment core in M4-09a, renewals in M4-11a and money-safe deletion in M4-19.

The owner's terms are in O-05 and MEMORY.md:
- Refunds are always full.
- Coaching is refundable within 7 days of the first payment.
- Renewals are not refundable.
- A 1:1 session is refundable up to 24 hours before it.
- An admin can refund by hand.

## Data
- The `refunds` table holds one row per refund.
- A refund has a reason: `first_payment`, `owed_back` or `admin`.
- A refund has a status: `requested`, `processed` or `failed`.
- A payment has at most one live refund. A live refund is requested or processed. A failed refund can be tried again.
- The athlete and the coach read a refund's state. They never read who asked for it or an admin's note.
- An order can now be `refunded`. Notifications gain the kind `refund_processed`.

## Flow
1. **Request.** A refund starts in one of three ways:
   - The athlete calls `request_refund`. It checks the terms.
   - An admin calls `admin_refund`. The terms do not apply.
   - The daily cron calls `queue_owed_back_refunds`. It covers every payment marked `duplicate`. That money is owed back, so the renewal rule does not apply. The cron sends these refunds in the same run.
   - Each request writes `audit_log`.
2. **Send.** The server calls `provider.refund`, then `attach_provider_refund`. The cron resends a requested refund that has no provider id and is older than 10 minutes.
3. **Apply.** The provider sends `refund.processed` or `refund.failed` to `apply_payment_event`. That function is still the one writer of money state. It finds the refund in this order:
   - by the provider's refund id;
   - by the payment, for a requested refund that has no provider id yet;
   - for a refund made at the provider's dashboard, it writes a new `admin` row.
   - It ignores a partial amount or a second refund of one payment, and never raises an error that the provider would retry.

## Effects of a processed refund
- The payment becomes `refunded`.
- For a captured payment:
  - The order becomes `refunded`.
  - A payout not yet paid becomes `reversed`.
  - A payout already paid stays as it is. `money_invariants` flags it for an admin.
- A refunded first payment sets the engagement to `refunded`, and access ends at once. The existing trigger ends the programs the coach assigned. The cron then stops the subscription.
- An admin can refund the first month of coaching that was already renewed. The months paid since run on.
- **Decision on a renewal refund:** an admin's refund of a renewed month sets the engagement to `ended`, not `refunded`. `paid_through` goes back to the last day of the month before. The earlier months were real coaching, so the client stays in `coach_stats`.
- A refund of a `duplicate` payment changes nothing else.
- The athlete gets a `refund_processed` notification. When coaching ends, both people get an email: `coaching_refunded` or `coaching_ended`.

## Payouts
- A coaching payout is held 7 days, the same as the refund window.
- A session payout is held at least until the day before the session. Refunds for the session close then.
- M4-13 must not release a payout while its payment has a requested refund.

## 1:1 sessions
Sessions have a date but no time until M4-17. Until then, "24 hours before" means 2 or more days before the session date, in India time.

## Out of this PR
- The admin page for payments and refunds moves to M4-18, the admin queue. `admin_refund` is built and tested here.
- Payout transfers and their reversal at the provider come with Razorpay Route in M4-13.
