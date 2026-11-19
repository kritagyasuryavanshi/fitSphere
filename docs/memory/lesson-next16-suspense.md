---
name: lesson-next16-suspense
type: lesson
description: 2026-11-13: Next 16 Cache Components: dynamic routes, usePathname, soft 404, hidden old pages, and accessible names
updated: 2026-11-19
---

Found while building the library in [[session-10]]. Related: [[lesson-prod-build-e2e]].

- A page that reads params or searchParams must put that work inside `<Suspense>`. Otherwise the build and dev log "uncached data".
- `usePathname()` on a dynamic route also needs `<Suspense>`. `HeaderLinks` and `BottomTabs` now wrap it, with a fallback that marks no link.
- `notFound()` inside `<Suspense>` streams a soft 404: status 200, the not-found page and a noindex tag. e2e checks the not-found heading, not the status. Relearned in [[session-12]] on `/join/[code]`: read this note before writing a 404 test.
- After client navigation the previous page stays in the DOM, hidden. Match text with `.filter({ visible: true })`, or by role and exact name. In [[session-12]], `getByLabel('Invite link')` also matched the hidden reset dialog labelled "Reset the invite link?".
- `npx playwright screenshot` fires before streamed content arrives. Pass `--wait-for-selector h1`.
- A link or button whose name ends in an `sr-only` span (`Edit<span className="sr-only">: Title</span>`) does not match the exact joined string in Playwright. Use a regex such as `{ name: /^Edit/ }` ([[session-12]]).
- The previous page's client state survives too: a client component's `useState` initialiser does not run again when you navigate back. The session player reopened mid-session after finishing until the page keyed it on the date and whether the session is finished ([[session-12]]).
