# M4-14 Verified reviews and coach replies: design

Date: 2026-11-22. Screens: X-Review and the reviews block on P-Coach.

## Rules
- Only the athlete of an engagement can review it, once.
- A review needs a finished paid period. At least one paid order must end before today. This is the owner's default in `docs/plans/m4-plan.md`: "after at least one completed paid month". A paid single session counts once its day has passed.
- Refunded coaching cannot be reviewed.
- The overall rating is required, from 1 to 5. The text is required, up to 1,000 characters.
- Three aspect ratings are optional: technique teaching, feedback speed and value for money. Each one is `excellent`, `good` or `okay`.
- Nobody edits or deletes a review through the app. The athlete and the coach have no write grant on the table.
- The coach can post one public reply, up to 1,000 characters. The reply cannot be changed.
- `hidden_at` lets an admin hide a review. The report queue in M4-18 sets it. A hidden review is not shown and does not count.
- Deleting the athlete's account deletes their reviews, because the words are theirs.

## Data
- `reviews`: one row per engagement, with the coach, the athlete, the ratings, the text, the reply and the times.
- `can_review(engagement)` tells the athlete's page whether to offer the form.
- `post_review` and `reply_review` are the only writers.
- `coach_reviews(coach)` is the public list. It shows the author as first name and last initial, the package, the months paid and the month of the review. It never returns the athlete's id.
- `coach_rating(coach)` returns the average of the visible reviews, rounded to one decimal, and their count. `find_coaches` uses it, so the list, the compare page and the rating filter agree with the profile.
- Notifications: `new_review` goes to the coach, and `review_reply` goes to the athlete.
- `export_my_data` gains the person's reviews and replies.

## Screens
- `/coaching`: a "Review {coach}" link on coaching that can be reviewed. It opens `/coaching/[id]/review`, built on X-Review.
- `/coaches/[id]`: the rating, the count and the latest 20 reviews, each with its reply.
- `/coach/reviews`: the coach's reviews, with a reply form on each one that has no reply. The clients page links to it. This is a new screen and waits for the owner's look.

## Out of this PR
- The Report link on each review comes with M4-18.
- Paging past 20 reviews waits until a coach has that many.
