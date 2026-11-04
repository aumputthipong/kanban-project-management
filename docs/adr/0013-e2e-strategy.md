# 0013 — E2E runs Playwright against the real stack, Chromium only

**Status:** Accepted

## Context

Unit tests (Go with mocked services, vitest) and the testcontainers integration
suite cover each layer, but nothing proved the layers work together: the Next
`/api` rewrite, the httpOnly auth cookies, the WebSocket ticket + Origin check,
and dnd-kit moves. A Playwright smoke spec existed but had never run — it only
started `next dev`, and no CI job executed it.

Two things shaped the setup. The prod compose stack is a poor test target: it
sets `ENV=production` (Secure cookies), the distroless backend has no
healthcheck, and the frontend image bakes `NEXT_PUBLIC_*` at build time. And
the hardcoded rate limits (20/min/IP on `/api/auth`) would throttle a suite that
registers a fresh user per test from one IP.

## Decision

- **Playwright, Chromium only.** It was already installed, and it can drive two
  browser contexts in one test, which the realtime tests need.
- **Playwright's `webServer` boots the stack** — `go run ./cmd/api` (waits on
  `/healthz`) and Next (`dev` locally, `start` after a build in CI). Postgres is
  the only outside dependency: `make dev` locally, a service container in CI.
  `make test-e2e` behaves the same in both.
- **Always `localhost`, never `127.0.0.1`** — the WS Origin check compares
  against `FRONTEND_URL` exactly.
- **Each test seeds its own user and board through the API** with unique
  names, so tests run in parallel without shared state. No direct SQL, no
  shared seeded accounts.
- **`RATE_LIMIT_DISABLED=true` turns the limiters off for e2e.** The server
  refuses to start if it is combined with `ENV=production`.
- **Selectors:** role/label first, text for user data, `data-testid` only where
  nothing semantic exists, never CSS classes.
- The CI job is not a required check until it has proved stable.

## Not doing

Visual regression (snapshot churn for a solo project; `design.md` covers
tokens), a cross-browser matrix, running against the deployed Render/Vercel
stack (cold starts, real limits, polluting demo data), and mocking the backend
inside e2e (that is a component test — vitest owns it).
