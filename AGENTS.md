# Project agent memory

This file is the project's committed home for project-intrinsic agent knowledge: build, test, release, architecture, and sharp-edge notes that should travel with the code.

- Add durable project-specific notes here as they are discovered through real work.

## E2E Tests

### Setup
- Playwright with MSW-inspired route mocking via `page.route('**/*', handler)` in `e2e/mocks/handlers.ts`
- Tests live in `e2e/*.spec.ts`, config in `playwright.config.ts`
- Run: `pnpm exec playwright test`

### Architecture
- ALL API calls go to `http://localhost:8000/*` (axios baseURL in `src/lib/api.ts`)
- Mock handler ONLY intercepts requests to `localhost:8000` — page navigations on port 3000 pass through
- Single catch-all `page.route('**/*')` dispatches by URL path + method
- In-memory stateful stores for agents, memories, files, tools — mutations (POST/PUT/DELETE) modify the arrays
- Route overrides per-test can be stacked on top (registered later takes precedence)

### Key patterns
- `setupApiMocks(page)` in `beforeEach` — registers the catch-all mock handler
- `mockLoggedIn(page)` — sets token cookies for middleware bypass (does NOT initialize Zustand store)
- `loginAsUser(page)` — full UI login flow for tests that need the auth store populated
- Use `getByRole('heading', ...)` instead of `getByText()` when heading text also appears elsewhere (sidebar nav links)
- Delete tests verify dialog dismissal + refetch: wait for dialog to close before asserting item is gone

### Known issues
- Chat SSE streaming is mocked with static response (no real streaming in tests)
- Auth store user is null after `mockLoggedIn` — only `loginAsUser` populates it
- Test worker count: CI uses 1, local uses default (4)
- Retries: 1 on CI, 0 locally
