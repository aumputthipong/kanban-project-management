# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

**Primary: recruiters and HR at companies in Thailand** evaluating the author's work. Turtask is a portfolio project, and its deployed instance exists to be judged, not to serve a real team. The visitor reads Thai, will not register or read the README, and leaves after about a minute. Design decisions rank this visitor first.

**Persona inside the product: a small Thai team** running its work on a shared Kanban. They plan in notes, move cards, and check what is due today. This is the story the app tells; the UI must stay believable as a real tool for them, but it does not outrank the evaluator.

## Product Purpose

A real-time Kanban for small teams: every teammate sees a card move the moment it happens, and the mover's UI never waits on the server.

Success is the evaluator leaving with two impressions, confirmed by the author:

1. **Visual craft:** the interface looks deliberate and finished, product-grade in its details.
2. **Product sense / UX:** the workflows were thought through, not just the CRUD.

Engineering depth (tests, CI, ADRs) is real and documented, but it is the README's job to carry it, not the UI's.

## Positioning

A Kanban that covers the work around the board, not just the board:

- **Planning notes become cards:** a planning session captures requirements, decisions and questions, and a note is sent to the Board as a card in one step.
- **My Work across every board:** one personal inbox of what is due today and overdue, ticked off in place.
- **Ownership at a glance:** the Team tab shows who holds which active card, from assignment and column alone.
- **Live by default:** optimistic moves plus WebSocket sync, so a second window updates without refresh.

## Operating Context

- The evaluator's path: landing page, then **Try demo**, which mints a throwaway account with a private copy of the sample board, deleted after 24 hours (a countdown banner says so). A shared demo login also exists.
- Free hosting: the first request after a quiet spell can take about a minute while the API wakes. Entry surfaces must not look broken during that wait.
- Desktop browsers are the expected evaluation setting; below `lg` the layouts stack and scroll.
- Surfaces: landing, auth, My Work, All Boards, Stash, and per project Overview, Planning, Board, Members, Calendar, Settings.

## Capabilities and Constraints

- **Design system authority:** `frontend/design.md` holds the tokens and Do's and Don'ts, mirrored in `frontend/src/app/globals.css` (`@theme`). Use existing tokens only; adding a token needs the author's approval first (AGENTS.md).
- **Copy language rule:** English for things that act as names or labels (actions, nav and feature names, entity and role names, enum values, form field and modal labels); Thai for anything read as a sentence (descriptions, helper text, toasts, errors, empty states, confirm bodies). Never mix two languages inside one label. Board and Note stay English inside Thai sentences.
- **Terminology:** Project is the container (members, settings, planning, stash). Board is only the Kanban view. The planning entity is a **Note** in the UI (internally `session`).
- **Roles:** Owner, Manager, Member, enforced on the backend; the UI only hides what a role cannot do.
- **Intentional gaps:** no roll-over of overdue tasks into Today (needs a backend field), no capacity or hours framing in the Team view, no card archive.
- **Entry surfaces are Thai-first** (decided 2026-10-19): sentences and headlines in Thai, with feature names and actions in English per the copy rule above.
- **Two entry paths on the landing:** **Try demo** is for anyone who wants to try without logging in (the evaluator's path, so it carries the primary weight). **Open Workspace** is the real-user path to their own workspace and requires login. Signed-in visitors are redirected away from `/` server-side, so everyone who sees the landing is signed out.

## Brand Commitments

- Name: **Turtask**. Current landing tagline: "Less standup. More shipping."
- Voice: plain, calm, readable Thai for sentences; no jargon; no emoji anywhere in UI or copy.

## Evidence on Hand

- A live, working product with a per-visitor demo sandbox seeded with an 8-card sample board.
- Screenshots: `docs/screenshots/` (board, my-work, overview, planning, members).
- Architecture notes and ADRs under `docs/`.
- **Absent, never fabricate:** real customers, testimonials, usage numbers, logos of companies, pricing, or a recorded production URL.

## Product Principles

1. **The first minute is the product.** Entry surfaces, the demo path, empty and loading states outrank depth features. A dead end costs more than a missing feature.
2. **Show the workflow, not the feature list.** Let the evaluator feel note to card to done, rather than reading claims about it.
3. **Finished over ambitious.** Every visible state is resolved: loading, empty, error, waking server. No raw strings or placeholders reach the screen.
4. **A believable tool for a real team.** Nothing on screen should read as staged for a demo once the visitor is inside the app.
