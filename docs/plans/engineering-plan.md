# FitSphere v1: Engineering Implementation Plan

Status: **Draft for owner approval** · Written 2026-11-05 · Source of truth for tasks: [`board.json`](board.json) (rendered as the Development Board artifact).

This plan turns the approved design (`docs/designs/fitsphere-v1.md`) and the 66 desktop + 67 phone screens (`docs/mockups/`) into small tasks. Each task is built, tested and verified before the next one starts.

## 1. Decisions this plan assumes

| Area | Choice | Status |
|---|---|---|
| App | Next.js (App Router), TypeScript strict, one codebase. No separate Python service in v1. | **Assumed. Owner to confirm.** |
| Hosting | Vercel, functions in the Mumbai region. Production deploys only with owner approval. | Approved in design |
| Database, auth, files | Supabase: Postgres with row-level security (RLS), Auth (email magic link + Google), private Storage for credential documents. Region: Mumbai (ap-south-1). | Approved in design |
| Payments | Razorpay: Orders, Subscriptions, Route for split payouts to coaches. Amounts stored as integer paise. | **Recommended. Owner to confirm.** |
| AI | Claude via the Anthropic API, server-side only. Retrieval uses Postgres full-text search in v1. No embeddings provider, which settles reviewer concern 1. | Approved in design |
| Email | Supabase Auth for sign-in links. Resend for feedback and payment emails. | Proposed |
| Video | YouTube embeds through `youtube-nocookie.com`. A daily job flags broken videos. | Approved in design |
| Styling | Tailwind CSS with the Fight Camp tokens (Anton + Inter, black and white, volt accent). | Proposed |
| Tests | Vitest (unit and component), pgTAP through `supabase test db` (database rules), Playwright (end-to-end), axe (accessibility). | Proposed |
| Time zone | All "today" logic in Asia/Kolkata. | Proposed |

Why no Python service: every v1 feature (CRUD, RLS, payments, calling Claude) runs well in Next.js route handlers. A second service doubles deploys, tests and auth checks. Add Python later only for custom ML, such as video pose analysis.

## 2. Architecture

```
Browser (PWA, phone first)
   │  Next.js App Router: server components for reads, server actions for writes
   ▼
Next.js on Vercel (Mumbai)
   ├─ /app/(public)     landing, libraries, lessons, coaches, programs, legal
   ├─ /app/(athlete)    today, session, progress, ask, account   [role: athlete]
   ├─ /app/(coach)      athletes, clients, programs, lessons     [role: coach]
   ├─ /app/(review)     review queue                             [role: reviewer]
   ├─ /app/(admin)      people, applications, credentials        [role: admin]
   ├─ /app/api/razorpay/webhook   signature-checked, idempotent
   ├─ /app/api/ai/ask             Claude call, daily limit, citations
   └─ cron: YouTube health check, renewal reminders
   ▼
Supabase (Mumbai): Postgres + RLS · Auth · Storage (private) · pg_cron
```

Rules that hold everywhere:
- The database enforces access. The UI only hides what RLS already blocks.
- Service-role keys live only in server code and CI secrets, never in the browser.
- Every write that moves money or changes a role goes through one server function with a test.
- Statistics shown to users come from SQL views over real logs and payments, never from typed-in numbers.

## 3. Data model (tables by area)

- **Identity:** `profiles`, `user_roles` (admin-granted), `consents` (one row per consent kind, explicit yes or no), `athlete_prefs`, `body_metrics` (optional), `coach_applications`, `audit_log`.
- **Content:** `categories` (boxing, sc, gym), `disciplines`, `content_items` (skill, drill, exercise; status draft → in_review → changes_requested → published; `is_sample`), `content_steps`, `content_links` (prerequisite, related, supports), `muscles`, `content_muscles`, `saves`, `completions`, `reviews_log`.
- **Training:** `programs` (versioned), `program_weeks`, `program_sessions`, `session_items` (typed prescription: rounds, time, or sets × reps × load), `invites`, `enrollments` (active, left, removed), `session_logs`, `set_logs`, `feedback`, `feedback_replies`.
- **Marketplace:** `coach_profiles`, `credentials`, `packages` (price in paise), `availability_slots`, `shortlists`, `hire_requests`, `conversations`, `messages`, `orders`, `payments`, `payment_events` (webhook idempotency), `subscriptions`, `engagements`, `refunds`, `payouts`, `reviews`, `client_stories`.
- **AI:** `ai_questions` (question, answer, citations, flags), daily limit function.

Key RLS rules (each one has a pgTAP test):
1. An athlete reads only their own data.
2. The public reads only published content. Drafts return 404.
3. A coach reads an athlete's logs and onboarding answers only while an active enrollment or engagement links them. Access ends the moment it ends.
4. A coach cannot publish. Nobody approves their own content.
5. Only an admin grants coach, reviewer or admin roles. Nobody changes their own role.
6. Messages are readable only by the two people in the conversation.
7. Only a client with a paid, finished engagement can review that coach. Coaches cannot edit or delete reviews.
8. A coach sees only their own clients, payouts and earnings.
9. Health fields (injury notes, body weight) go to the AI only when the matching consent row says yes.

## 4. How we build: the working loop

For every task on the board:
1. Pick the top **To do** task whose dependencies are all **Done**. Mark it **In progress**. Only one task is in progress at a time.
2. Write the tests from its acceptance criteria first. Watch them fail. This applies to any logic: rules, calculations, money, access.
3. Build the smallest change that makes them pass. Match the canvas screen for anything visible.
4. Run `npm run verify` (typecheck, lint, unit, database tests, build), plus the task's end-to-end test.
5. Mark the task **Done** in `board.json` with the date and commit hash, re-render the board, commit, and push.
6. At the end of each milestone, run its milestone check (below). Auth, RLS, payments and migrations also get one Codex review of the full milestone diff.

Stop rules: if a task fails twice, stop patching, reproduce the failure, get an independent diagnosis, then fix the root cause. If a task grows past one day, split it on the board first.

## 5. Phases and milestone checks

| Phase | What ships | Milestone check (all must pass) |
|---|---|---|
| **S0 Setup** | Repo, tokens, components, local Supabase, CI, previews, test harnesses | `npm run verify` green in CI on an empty app. A preview URL per PR. |
| **M1 Foundation** | Sign-in, 4-step sign-up with the 18+ check, roles, app shells, admin people page, coach applications, account and consent | The six original policy tests pass. The end-to-end sign-up passes. Under 18 is blocked and nothing is saved. |
| **M2 Library** | Boxing, S&C and Gym libraries, lesson and exercise pages, search, save and complete, author → review → publish | The design doc's M2 check: browse to the jab lesson, filter, save, complete, reload. Drafts 404. "jab" search works. Sample says Sample. |
| **M3 Training** | Program builder, invites, enrollments, Today, boxing player, set logger, progress, coach dashboard, feedback | The design doc's M3 check, plus a gym workout logged with last-time numbers. Progress numbers equal the logs. |
| **M4 Marketplace** | Coach profiles, discovery, compare, shortlist, hire, chat, payments, renewals, refunds, payouts, reviews, credential checks | The M4 check in the design doc. The 20-item payments go-live checklist. Codex final review. Test mode only until the owner approves live mode. |
| **M5 AI guide** | Retrieval, cited answers, safety, daily limit, chat UI, eval set | `npm run eval:ai`: 100% on code-checked rules in 3 runs, judge average ≥ 90%. |
| **M6 Launch** | Public pages, legal, all states, PWA, speed, accessibility, security, QA | Lighthouse mobile ≥ 80 on landing, library and Today. No dead buttons. `/qa` finds no high-severity bugs. Legal sign-off. Owner approves production. |

## 6. Owner dependencies (block specific tasks)

| Need | Blocks | Task |
|---|---|---|
| Confirm the stack | S0-02 onward | O-01 |
| Supabase, Vercel, Anthropic, Google OAuth accounts | S0-04, S0-06, M1-02 | O-02 |
| Upgrade this PC to Node 22 | S0-02 | O-03 |
| Payment provider account and KYC, business and GST registration | M4-09 onward | O-04 |
| Fee %, refund and cancel terms, coach agreement | M4-09 to M4-12 | O-05 |
| Founding coaches and their first lessons | M2 real content, M6 launch | O-06 |
| Legal review (DPDP privacy policy, terms) | M6-02 | O-07 |
| Nutrition: in or out | Nothing in v1 (out by default) | O-08 |

## 7. Keeping the plan current

- `board.json` is the single source of truth. Each task has an id, phase, title, dependencies, priority (P0 must, P1 should, P2 nice), size (S ≤ half a day, M ≤ one day), status, acceptance criteria and test type.
- After each task: update its status, `done_on` and `commit`, run `python docs/plans/build_board.py`, and republish the board artifact.
- Changes in scope go on the board first, with a one-line reason in `MEMORY.md`.
