# Roadmap

## Current request (5 Oct)
- [x] Apply a white, blue, and green theme in light and dark mode; browser screenshots checked, no runtime errors.
- [x] Repair Generate Test launch into CBT: authenticated question selection, hydration-aware loading, explicit loading errors, and submission-save checks.
- [ ] Verify authenticated generation and capture CBT screenshot — blocked: external database has no supplied browser session. Requires the user to sign in with Generate Test access.
- [ ] Confirm connection to akmalthegreat/neetiq-prime — GitHub connection is user-managed; available project metadata does not confirm the requested repository.

## In progress
- [ ] **Feature locks** — gate every premium screen behind an active batch, with an upgrade CTA to .
- [ ] **1-day trial plan** — new users get Essential features for 24h; dashboard banner shows trial status + upgrade links.
- [ ] **Remove bonus system** — strip all bonus coins / bonus page / bonus wording from the app.

## Queued (requested 17 Sep)
- [ ] **Media & diagrams via GitHub CDN** — point question diagram resolvers, NCERT image URLs and static media paths at
       instead of broken local paths / old domains.
      Verify diagram-based questions and icons render.
- [ ] **Hostinger MySQL backend** — move backend functions and NCERT highlights/nuggets retrieval off Supabase onto the remote
      MySQL database using , , , , .
      NOTE: needs a decision — auth/profiles/wallet currently depend on Supabase; confirm scope before migrating.
- [ ] **Local verification** — confirm diagram questions and NCERT highlights load with no missing-asset errors.

## Later
- [ ] **NCERT diagram pipeline** — crop each figure from the uploaded PDF, OCR its fig code, match to , strip copyright.

## Release checklist (requested 17 Sep)
- [ ] Land all pending work as one clean change set.
- [ ] Run a full production build locally and confirm: no build errors, no missing-asset errors, no server-render crashes.
