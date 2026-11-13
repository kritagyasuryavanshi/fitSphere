---
name: lesson-next16-suspense
type: lesson
description: 2026-11-13: Next 16 Cache Components: dynamic routes, usePathname, soft 404 and hidden old pages
updated: 2026-11-13
---

Found while building the library in [[session-10]]. Related: [[lesson-prod-build-e2e]].

- A page that reads params or searchParams must put that work inside `<Suspense>`. Otherwise the build and dev log "uncached data".
- `usePathname()` on a dynamic route also needs `<Suspense>`. `HeaderLinks` and `BottomTabs` now wrap it, with a fallback that marks no link.
- `notFound()` inside `<Suspense>` streams a soft 404: status 200, the not-found page and a noindex tag. e2e checks the not-found heading, not the status.
- After client navigation the previous page stays in the DOM, hidden. Match text with `.filter({ visible: true })`.
- `npx playwright screenshot` fires before streamed content arrives. Pass `--wait-for-selector h1`.
