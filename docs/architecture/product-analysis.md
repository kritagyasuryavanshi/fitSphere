# FitSphere v1: Product Analysis

Analysed 2026-11-05 from `docs/designs/fitsphere-v1.md`, `docs/PRODUCT_BRIEF.md` and the canvas sources in `docs/mockups/` (66 desktop and 67 phone screens). No design was changed during this analysis.

## 1. Product in one paragraph

FitSphere is one mobile-first website for adults (18+) in India. Athletes learn boxing, strength and conditioning (S&C) and gym fitness from coach-reviewed lessons, train from coach programs, log every session, and ask an AI guide that cites its sources. Coaches build programs, invite athletes by link, watch their logs and send feedback. Coaches also sell coaching through a marketplace, where athletes compare, hire and pay them. A second coach reviews every lesson before it goes live. An admin grants roles and checks coach credentials.

## 2. Roles

| Role | Gets in by | Main areas |
|---|---|---|
| Guest | Visiting the site | Landing, libraries, lessons, programs, coach marketplace, help, legal |
| Athlete | Email link or Google, 18+ sign-up | Today, Learn, Progress, Ask AI, Account, hiring a coach |
| Coach | Application approved by an admin | Athletes, Clients, Programs, My lessons, marketplace profile, earnings |
| Reviewer | Coach who is also given the reviewer role by an admin | Review queue, plus coach areas |
| Admin | The founder | People and roles, coach applications, credential checks, review queue |

One account can hold several roles. A coach also uses the athlete side through the "Athlete site" link.

## 3. Feature areas

| ID | Area | Features | Screens |
|---|---|---|---|
| F1 | Sign-in and sign-up | Email link, Google, 4-step sign-up, 18+ block, separate consent for health data | A-SignIn, A-CheckEmail, A-Onboard1, C-Onboarding, A-OnboardGym, A-Ready, A-Under18 |
| F2 | Library | Three categories (Boxing, S&C, Gym & Fitness), filters, lesson and exercise pages, rep ranges per goal, search, save, complete, skill path, Sample label | C-Library, P-LibrarySC, G-Library, C-Lesson, P-Drill, G-Exercise, P-Search, T-Saved |
| F3 | Content workflow | Coach writes, second coach reviews, publish or send back, no self-approval, broken-video flag | K-Lessons, K-Editor, R-Queue, R-Review |
| F4 | Programs | Builder (weeks, sessions, items, prescriptions), versions, invite links, reset, join, leave, remove | K-Programs, C-Builder, K-Invite, K-ConfirmReset, A-Invite, T-MyPrograms, K-ConfirmRemove, P-Programs, P-Program, G-Program |
| F5 | Training | Today (merged across programs), boxing round player, S&C and gym set logger with last-time numbers and next target, done summaries | C-Today, G-Today, T-TodayEmpty, C-Session, T-SessionSC, G-Workout, T-SessionDone, G-WorkoutDone |
| F6 | Progress | Sessions, adherence, records, skill ratings, sets per muscle, optional body weight | C-Progress, G-Progress |
| F7 | Coaching | Dashboard with flags, athlete detail, feedback and replies | C-CoachDash, K-Athlete, T-Feedback |
| F8 | Marketplace | Discovery, filters, coach profile with computed stats, compare, shortlist, hire request, chat, checkout, renewal, refunds, verified reviews, coach clients, profile editor, earnings, credential checks | P-Coaches, P-Coach, X-* (11 screens) |
| F9 | AI guide | Cited answers, no-match mode, injury safety, daily limit, actions | C-AI, lesson AI block |
| F10 | Account and privacy | Profile, consent switches, data download, delete account | T-Account, T-ConfirmDelete |
| F11 | Admin | People and roles, coach applications, credential checks | R-Roles, P-ForCoaches, P-Applied, X-Verify |
| F12 | Public and system | Landing, about, help, privacy and terms, 404, visitor phone menu | C-Landing, P-About, P-Help, P-Legal, P-NotFound, M-Menu |

## 4. User journeys

Each journey lists its screens in order. These become the end-to-end tests.

| ID | Journey | Path |
|---|---|---|
| J1 | Guest discovers and joins | Landing → Library → Lesson → Join free → Check email → Sign-up 1–4 → Today (empty) |
| J2 | Under-18 is stopped | Sign-up 1 → Under-18 block (nothing saved) |
| J3 | Athlete joins a coach's program | Invite link → sign in or join → Join program → Today |
| J4 | Athlete trains boxing | Today → Session player → log rounds → Session done → Progress |
| J5 | Athlete trains in the gym | Gym Today → Workout (last time, next target) → Workout done → Gym progress |
| J6 | Athlete asks the AI | Lesson or Ask AI → cited answer → open lesson or add to Today; pain → referral and coach flag |
| J7 | Athlete hires a coach | Find a coach → profile → compare or shortlist → Hire → chat → coach accepts → checkout → coaching starts → Today |
| J8 | Athlete reviews a coach | My programs → Review the coach (paid, finished engagement only) |
| J9 | Athlete leaves, cancels or deletes | My programs → Leave (confirm) · Account → Delete (confirm) |
| J10 | Coach joins | For coaches → apply → admin approves → coach header appears |
| J11 | Coach builds and shares | Programs → Builder → publish → Invite → share link |
| J12 | Coach monitors and responds | Dashboard → flag → Athlete detail → feedback → athlete sees it |
| J13 | Coach publishes a lesson | My lessons → Editor → submit → reviewer approves → live in library |
| J14 | Coach sells coaching | Profile editor (packages, slots) → request → accept → client pays → earnings and payout |
| J15 | Admin runs the platform | People and roles · applications · credential checks |

## 5. Assets

| Asset | Source | Status |
|---|---|---|
| Fonts | Anton (display) and Inter (body) from Google Fonts, both under the Open Font License | Ready to self-host with `next/font` |
| Colours | Ink #111111, paper #FFFFFF, mist #F5F5F5, lines #E5E5E5 / #CACACB, greys #707072 / #9E9EA0 / #39393B, volt #D4F000, status green #00653A, amber #8A4600, red #A3001A | Ready as tokens |
| Icons | Inline stroke SVGs (search, back, next, check, close, plus, play, link, alert, send, heart, star, shield, chat, tab icons) | Ready to turn into one icon component |
| Photos | 30 Unsplash photos (`docs/mockups/images/`, credits in `CREDITS.md`) | **Demo only.** Real coach photos and lesson thumbnails must replace them before launch |
| Video | YouTube links per lesson | Coaches supply them |
| Copy | All screen text is demo copy; coach names, reviews and numbers are fictional | Real content from founding coaches |

## 6. Design observations for owner approval

These are inconsistencies found during analysis. None was changed. Each needs your yes before anyone edits the design.

| ID | Observation | Suggested fix |
|---|---|---|
| D1 | Page titles are stale on two screens: "Sign up step 3: Ready" is now step 4, and "Onboarding" has no step number | Rename the titles only |
| D2 | The 67 phone screens were generated from desktop layouts by a script and have not been reviewed by eye | Review the five most-used phone screens before M1 |
| D3 | Wide tables (coach dashboard, my lessons, clients) scroll sideways on phones | Accept, or design a stacked card layout for phones |
| D4 | The prototype cannot reach the Under-18 screen by clicking; it is a branch from step 1 | Accept (it is a server-side branch) |
| D5 | Today, Progress and Gym Today show two different demo users (Kabir for boxing, Neha for gym) | Accept as demo data; the build uses one data model |
| D6 | Some screens are missing; see section 5 of `risks-and-gaps.md` (1:1 session booking, cancel paid coaching, notifications, coach empty states, report abuse) | Design them before their board tasks start |
